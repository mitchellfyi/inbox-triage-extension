/**
 * Voice Input Module
 * Handles voice dictation for guidance textarea
 */

export class VoiceInput {
    constructor(elements, updateStatusCallback) {
        this.elements = elements;
        this.updateStatus = updateStatusCallback;
        this.isRecording = false;
        this.recognition = null;
        this.recognitionTimeout = null;
    }

    /**
     * Initialize voice input
     */
    initialize() {
        // Check for Web Speech API support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Web Speech API not supported');
            if (this.elements.micBtn) {
                this.elements.micBtn.disabled = true;
                this.elements.micBtn.title = 'Voice input not supported in this browser';
            }
            return false;
        }

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-GB';

        this.setupRecognitionHandlers();

        // Bind mic button event
        if (this.elements.micBtn) {
            this.elements.micBtn.addEventListener('click', () => this.toggle());
            this.elements.micBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        }

        return true;
    }

    /**
     * Setup speech recognition event handlers
     */
    setupRecognitionHandlers() {
        if (!this.recognition) return;

        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.isRecording = true;
            this.updateMicrophoneUI('recording');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                // Append to guidance textarea
                const currentText = this.elements.guidanceText.value;
                this.elements.guidanceText.value = currentText + (currentText ? ' ' : '') + finalTranscript.trim();
            }

            // Reset auto-stop timer
            this.resetAutoStopTimer();
        };

        this.recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            
            let errorMessage = 'Voice input error';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Try again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone not found. Check permissions.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied.';
                    break;
                case 'network':
                    errorMessage = 'Network error during voice recognition.';
                    break;
                default:
                    errorMessage = `Voice input error: ${event.error}`;
            }
            
            this.updateMicStatus(errorMessage, 'error');
            this.stop();
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isRecording = false;
            this.updateMicrophoneUI('inactive');
            this.clearAutoStopTimer();
        };
    }

    /**
     * Toggle voice dictation on/off
     */
    toggle() {
        if (!this.recognition) {
            this.updateStatus('Voice input not available', 'error');
            return;
        }

        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Start voice dictation
     */
    start() {
        try {
            this.recognition.start();
            this.updateMicStatus('🎤 Listening... Speak now', 'info');
            this.startAutoStopTimer();
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.updateMicStatus('Failed to start voice input', 'error');
        }
    }

    /**
     * Stop voice dictation
     */
    stop() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.updateMicStatus('Voice input stopped', 'info');
            this.clearAutoStopTimer();
        }
    }

    /**
     * Update microphone button UI state
     * @param {string} state - 'inactive', 'recording', 'processing'
     */
    updateMicrophoneUI(state) {
        if (!this.elements.micBtn) return;

        switch (state) {
            case 'recording':
                this.elements.micBtn.classList.add('recording');
                this.elements.micBtn.setAttribute('aria-label', 'Stop voice input (currently recording)');
                this.elements.micBtn.textContent = '⏹️';
                break;
            case 'processing':
                this.elements.micBtn.classList.remove('recording');
                this.elements.micBtn.setAttribute('aria-label', 'Voice input processing');
                this.elements.micBtn.textContent = '⏳';
                break;
            case 'inactive':
            default:
                this.elements.micBtn.classList.remove('recording');
                this.elements.micBtn.setAttribute('aria-label', 'Start voice input for guidance');
                this.elements.micBtn.textContent = '🎤';
                break;
        }
    }

    /**
     * Update microphone status message
     * @param {string} message - Status message
     * @param {string} type - Message type ('info', 'error', etc.)
     */
    updateMicStatus(message, type = 'info') {
        this.updateStatus(message, type);
    }

    /**
     * Start auto-stop timer (stops recording after 10 seconds of silence)
     */
    startAutoStopTimer() {
        this.recognitionTimeout = setTimeout(() => {
            if (this.isRecording) {
                console.log('Auto-stopping voice input after silence');
                this.stop();
                this.updateMicStatus('Voice input stopped (silence detected)', 'info');
            }
        }, 10000); // 10 seconds
    }

    /**
     * Reset auto-stop timer
     */
    resetAutoStopTimer() {
        this.clearAutoStopTimer();
        this.startAutoStopTimer();
    }

    /**
     * Clear auto-stop timer
     */
    clearAutoStopTimer() {
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
            this.recognitionTimeout = null;
        }
    }

    /**
     * Cleanup voice input
     */
    cleanup() {
        this.stop();
        this.clearAutoStopTimer();
        if (this.recognition) {
            this.recognition.onstart = null;
            this.recognition.onresult = null;
            this.recognition.onerror = null;
            this.recognition.onend = null;
        }
    }
}

