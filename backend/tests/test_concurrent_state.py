"""Concurrent access tests for StateStore thread safety."""

import threading
import time
from datetime import datetime

from backend.src.state import ExecutionState, ExecutionStatusEnum, StateStore


def _make_execution(execution_id: str) -> ExecutionState:
    return ExecutionState(
        execution_id=execution_id,
        status=ExecutionStatusEnum.PENDING,
        created_at=datetime.now(),
    )


def test_multiple_readers_during_write_do_not_block():
    """Multiple status readers should stay responsive while writes happen."""
    store = StateStore()
    execution_id = "exec-readers"
    store.set_execution(_make_execution(execution_id))

    writer_done = threading.Event()
    reader_latencies = []
    latency_lock = threading.Lock()

    def writer() -> None:
        for _ in range(50):
            store.update_execution_status(execution_id, ExecutionStatusEnum.RUNNING)
            time.sleep(0.005)
        store.update_execution_status(execution_id, ExecutionStatusEnum.COMPLETED)
        writer_done.set()

    def reader() -> None:
        while not writer_done.is_set():
            start = time.perf_counter()
            state = store.get_execution(execution_id)
            elapsed = time.perf_counter() - start
            assert state is not None
            with latency_lock:
                reader_latencies.append(elapsed)
            time.sleep(0.002)

    writer_thread = threading.Thread(target=writer)
    reader_threads = [threading.Thread(target=reader) for _ in range(4)]

    writer_thread.start()
    for thread in reader_threads:
        thread.start()

    writer_thread.join(timeout=2.0)
    for thread in reader_threads:
        thread.join(timeout=2.0)

    assert writer_done.is_set(), "Writer thread did not finish"
    assert reader_latencies, "Expected at least one reader latency measurement"
    assert max(reader_latencies) < 0.05, "Reads blocked during writes"


def test_rapid_concurrent_writes_do_not_lose_data():
    """Concurrent writes should retain every execution state."""
    store = StateStore()
    total_writes = 200

    def write_state(index: int) -> None:
        store.set_execution(_make_execution(f"exec-{index}"))

    threads = [
        threading.Thread(target=write_state, args=(i,)) for i in range(total_writes)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=2.0)

    all_states = store.get_all_executions()
    assert len(all_states) == total_writes
    assert {f"exec-{i}" for i in range(total_writes)} == set(all_states.keys())


def test_reads_do_not_block_during_simulated_long_worker_operation():
    """A worker long operation should not deadlock status polling."""
    store = StateStore()
    execution_id = "exec-worker"
    store.set_execution(_make_execution(execution_id))

    worker_done = threading.Event()
    poll_count = 0
    poll_count_lock = threading.Lock()
    read_latencies = []
    read_latencies_lock = threading.Lock()

    def worker() -> None:
        state_copy = store.get_execution(execution_id)
        assert state_copy is not None
        state_copy.status = ExecutionStatusEnum.RUNNING
        store.set_execution(state_copy)
        time.sleep(0.4)
        state_copy.status = ExecutionStatusEnum.COMPLETED
        store.set_execution(state_copy)
        worker_done.set()

    def poller() -> None:
        nonlocal poll_count
        while not worker_done.is_set():
            start = time.perf_counter()
            state = store.get_execution(execution_id)
            elapsed = time.perf_counter() - start
            assert state is not None
            with poll_count_lock:
                poll_count += 1
            with read_latencies_lock:
                read_latencies.append(elapsed)
            time.sleep(0.01)

    worker_thread = threading.Thread(target=worker)
    poller_thread = threading.Thread(target=poller)

    worker_thread.start()
    poller_thread.start()

    worker_thread.join(timeout=2.0)
    poller_thread.join(timeout=2.0)

    assert worker_done.is_set(), "Worker thread deadlocked"
    assert poll_count > 5, "Expected repeated polling during long operation"
    assert read_latencies, "Expected read latencies to be captured"
    assert max(read_latencies) < 0.05, "Polling reads were blocked"

    final_state = store.get_execution(execution_id)
    assert final_state is not None
    assert final_state.status == ExecutionStatusEnum.COMPLETED


def test_queue_operations_are_thread_safe_under_concurrent_access():
    """Concurrent queue producers/consumers should not lose or duplicate items."""
    store = StateStore()
    producers = 5
    items_per_producer = 40
    total_items = producers * items_per_producer
    consumers = 4

    start_event = threading.Event()
    producers_done = threading.Event()
    consumed = []
    consumed_lock = threading.Lock()

    def producer(start_index: int) -> None:
        start_event.wait(timeout=1.0)
        for i in range(items_per_producer):
            store.enqueue(f"q-{start_index + i}")

    def consumer() -> None:
        start_event.wait(timeout=1.0)
        while True:
            item = store.dequeue()
            if item is None:
                if producers_done.is_set() and store.get_queue_size() == 0:
                    return
                time.sleep(0.001)
                continue
            with consumed_lock:
                consumed.append(item)

    producer_threads = [
        threading.Thread(target=producer, args=(p * items_per_producer,))
        for p in range(producers)
    ]
    consumer_threads = [threading.Thread(target=consumer) for _ in range(consumers)]

    for thread in producer_threads + consumer_threads:
        thread.start()

    start_event.set()

    for thread in producer_threads:
        thread.join(timeout=2.0)
    producers_done.set()
    for thread in consumer_threads:
        thread.join(timeout=2.0)

    assert len(consumed) == total_items
    assert len(set(consumed)) == total_items
    assert set(consumed) == {f"q-{i}" for i in range(total_items)}
    assert store.get_queue_size() == 0
