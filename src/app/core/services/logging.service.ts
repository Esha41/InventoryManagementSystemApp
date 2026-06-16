import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';

/**
 * Centralized logging service for consistent error tracking and debugging
 * Respects environment configuration for log levels
 */
@Injectable({
    providedIn: 'root'
})
export class LoggingService {
    constructor(private configService: ConfigService) { }

    /**
     * Log error messages
     */
    error(message: string, error?: unknown): void {
        if (this.shouldLog()) {
            console.error(`[ERROR] ${message}`, error || '');
        }

        // Future: Send to external error tracking service (e.g., Sentry, AppInsights)
        this.sendToExternalService('error', message, error);
    }

    /**
     * Log warning messages
     */
    warn(message: string, data?: unknown): void {
        if (this.shouldLog()) {
            console.warn(`[WARN] ${message}`, data || '');
        }
    }

    /**
     * Log info messages
     */
    info(message: string, data?: unknown): void {
        if (this.shouldLog()) {
            console.info(`[INFO] ${message}`, data || '');
        }
    }

    /**
     * Log debug messages (only in development)
     */
    debug(message: string, data?: unknown): void {
        if (this.shouldLog() && !this.configService.isProduction) {
            console.debug(`[DEBUG] ${message}`, data || '');
        }
    }

    /**
     * Check if logging is enabled based on environment
     */
    private shouldLog(): boolean {
        return this.configService.isLoggingEnabled || !this.configService.isProduction;
    }

    /**
     * Send logs to external service (placeholder for future implementation)
     */
    private sendToExternalService(_level: string, _message: string, _data?: unknown): void {
        // TODO: Implement integration with error tracking service
        // Example: Sentry.captureException, Application Insights, etc.
    }
}
