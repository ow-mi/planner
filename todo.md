

# ./ui_v2_
The ui should fill the browser page width wise, and add a scroll bar for going down (the header should always remain visible). 
when inputting csv's, there are still duplicates in the list, add logging for this, and also when hard refreshing there are still elements in the list for some reason.





## edit tab
- there are several duplicates of each csv in the dropdown menu
## configuration tab
### Leg deadlines section
- the ui should load based on the .json file that is uploaded, currently they have values (eg certain legs) before the .json is uploaded, the same issue appears in the  Test Proximity Rules section
- 
### Objective Function Weights section
- should be 1 slider, from 0-100% with makespane on one side and riority on the other 
  - when at 0%, it's fully makespane. makespane = 1.0
  - when it 100% it's fully priority, prority = 1.0

- should not have a remove option
- should have a start and end deadline date, set in the format 2026-W30.5
- the start and end deadline dates should have an enable checkboxes for each
- there should be no add leg option
### Test Proximity Rules
- the layout is good, we need to have every test that exists in the input data here (so the unique test of the test csv data)
- there should be no remove action
### Objective Function Weights
- can be a slider 
### Priority Configuration Settings (Output)
need to be updated to make the json that is used for the solved, should be updated on any input change throughout the configuration page. 
## sovler
solver execution does not work yet. 

Solver execution failed: TypeError: can't access property "files", this.$store is undefined
    executeSolver http://localhost:3000/assets/js/stores/solverStore.js:71
    runSolver http://localhost:3000/index.html#solver line 1 > injectedScript:50
    anonymous https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js line 5 > AsyncFunction:3
    Fn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    or https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    s https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    o https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    o https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    a https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    ae https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    <anonymous> https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    A https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    r https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    n https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    fr https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    v https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    gr https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    mt https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    mt https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Dn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Dn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Dn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    dt https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    m https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    <anonymous> https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    VoidFunction* https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    r https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    n https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    fr https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    v https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    <anonymous> http://localhost:3000/index.html#configuration:43
    he https://unpkg.com/htmx.org@2.0.0:1
    ze https://unpkg.com/htmx.org@2.0.0:1
    se https://unpkg.com/htmx.org@2.0.0:1
    ze https://unpkg.com/htmx.org@2.0.0:1
    e https://unpkg.com/htmx.org@2.0.0:1
    Mn https://unpkg.com/htmx.org@2.0.0:1
    onload https://unpkg.com/htmx.org@2.0.0:1
    de https://unpkg.com/htmx.org@2.0.0:1
    Hn https://unpkg.com/htmx.org@2.0.0:1
    loadTabContent http://localhost:3000/index.html#configuration:676
    initializeStores http://localhost:3000/index.html#configuration:617
    i https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    i https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    r https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    Nn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Mn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Rn https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    Ut https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    scheduler https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
    l https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    U https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    Ai https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:5
    set https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js:1
solverStore.js:98:25

