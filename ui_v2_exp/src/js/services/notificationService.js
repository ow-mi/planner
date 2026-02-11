/**
 * Notification Service - Global notification system
 *
 * Handles displaying notifications, alerts, and messages to users
 */
class NotificationService {
    constructor() {
        this.notificationContainer = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        this.notificationContainer = document.getElementById('notification-container');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notification-container';
            this.notificationContainer.style.position = 'fixed';
            this.notificationContainer.style.top = '20px';
            this.notificationContainer.style.right = '20px';
            this.notificationContainer.style.zIndex = '10000';
            this.notificationContainer.style.maxWidth = '400px';
            this.notificationContainer.style.width = '100%';
            document.body.appendChild(this.notificationContainer);
        }
    }

    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds
     */
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Style the notification
        notification.style.padding = '1rem 1.5rem';
        notification.style.marginBottom = '1rem';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.color = 'white';
        notification.style.fontSize = '0.9rem';
        notification.style.animation = 'slideIn 0.3s ease-out';

        // Set colors based on type
        const colors = {
            success: { background: 'var(--success-color)' },
            error: { background: 'var(--danger-color)' },
            warning: { background: 'var(--warning-color)' },
            info: { background: 'var(--info-color)' }
        };

        Object.assign(notification.style, colors[type]);

        // Add to container
        this.notificationContainer.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            this.remove(notification);
        }, duration);
    }

    /**
     * Show success notification
     */
    success(message, duration = 5000) {
        this.show(message, 'success', duration);
    }

    /**
     * Show error notification
     */
    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }

    /**
     * Show warning notification
     */
    warning(message, duration = 5000) {
        this.show(message, 'warning', duration);
    }

    /**
     * Show info notification
     */
    info(message, duration = 5000) {
        this.show(message, 'info', duration);
    }

    /**
     * Remove a notification
     */
    remove(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                notification.parentNode.removeChild(notification);
            }, 300);
        }
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        while (this.notificationContainer.firstChild) {
            this.remove(this.notificationContainer.firstChild);
        }
    }
}

// Create global instance
window.notificationService = new NotificationService();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
}
