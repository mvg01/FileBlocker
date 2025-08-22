class FileExtensionBlocker {
    constructor() {
        this.baseUrl = '/api/extensions';
        this.fixedExtensionsContainer = document.getElementById('fixed-extensions');
        this.customExtensionsContainer = document.getElementById('custom-extensions');
        this.customInput = document.getElementById('custom-extension-input');
        this.addButton = document.getElementById('add-custom-btn');
        this.customCountElement = document.getElementById('custom-count');

        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('file-input');
        this.testResults = document.getElementById('test-results');

        this.currentExtensionData = null;
        this.toastContainer = document.getElementById('toast-container');

        this.fileSizeLimitInput = document.getElementById('file-size-limit');
        this.saveSizeLimitBtn = document.getElementById('save-size-limit-btn');
        this.currentSizeLimitSpan = document.getElementById('current-size-limit');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
        await this.loadFileSizeLimit();
    }

    bindEvents() {
        this.addButton.addEventListener('click', () => this.addCustomExtension());
        this.customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addCustomExtension();
            }
        });

        this.customInput.addEventListener('input', () => this.validateInput());

        this.saveSizeLimitBtn.addEventListener('click', () => this.saveFileSizeLimit());
        this.fileSizeLimitInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveFileSizeLimit();
            }
        });

        this.bindFileUploadEvents();
    }

    bindFileUploadEvents() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    validateInput() {
        const value = this.customInput.value.trim();
        const isValid = value.length > 0 && value.length <= 20;
        this.addButton.disabled = !isValid;
    }

    async loadData() {
        try {
            const response = await fetch(this.baseUrl);
            if (!response.ok) throw new Error('Failed to load data');

            const data = await response.json();
            this.currentExtensionData = data;
            this.renderFixedExtensions(data.fixedExtensions);
            this.renderCustomExtensions(data.customExtensions);
            this.updateCustomCount(data.customExtensions.length);
        } catch (error) {
            this.showError('데이터를 불러오는데 실패했습니다.');
            console.error('Error loading data:', error);
        }
    }

    handleFiles(files) {
        if (!this.currentExtensionData) {
            this.showError('확장자 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        this.clearTestResults();

        Array.from(files).forEach(file => {
            this.testFile(file);
        });

        this.fileInput.value = '';
    }

    testFile(file) {
        const fileName = file.name;
        const extension = this.getFileExtension(fileName);
        const isExtensionBlocked = this.isExtensionBlocked(extension);
        const isSizeExceeded = this.isFileSizeExceeded(file.size);

        const isBlocked = isExtensionBlocked || isSizeExceeded;

        this.addTestResult(fileName, extension, isBlocked, isSizeExceeded, file.size);
    }

    getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) return '';
        return fileName.substring(lastDot + 1).toLowerCase();
    }

    isExtensionBlocked(extension) {
        if (!extension) return false;

        const blockedFixedExtensions = this.currentExtensionData.fixedExtensions
            .filter(ext => ext.blocked)
            .map(ext => ext.name);

        const customExtensions = this.currentExtensionData.customExtensions;

        return blockedFixedExtensions.includes(extension) || customExtensions.includes(extension);
    }

    isFileSizeExceeded(fileSizeBytes) {
        if (!this.currentExtensionData || !this.currentExtensionData.fileSizeLimit) {
            return false; // 제한 없음
        }

        const limitBytes = this.currentExtensionData.fileSizeLimit * 1024 * 1024; // MB to bytes
        return fileSizeBytes > limitBytes;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    addTestResult(fileName, extension, isBlocked, isSizeExceeded = false, fileSize = 0) {
        if (this.testResults.children.length === 0) {
            this.addClearButton();
        }

        const resultItem = document.createElement('div');
        resultItem.className = `test-result-item ${isBlocked ? 'blocked' : 'allowed'}`;

        if (isSizeExceeded) {
            resultItem.classList.add('size-violation');
        }

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'test-result-filename';
        fileNameSpan.textContent = fileName;

        const extensionSpan = document.createElement('span');
        extensionSpan.className = 'test-result-extension';
        extensionSpan.textContent = extension ? `.${extension}` : '확장자 없음';

        const fileSizeSpan = document.createElement('span');
        fileSizeSpan.className = 'test-result-size';
        fileSizeSpan.textContent = this.formatFileSize(fileSize);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'test-result-status';

        if (isSizeExceeded) {
            statusSpan.textContent = '차단됨';
        } else {
            statusSpan.textContent = isBlocked ? '차단됨' : '허용됨';
        }

        resultItem.appendChild(fileNameSpan);
        resultItem.appendChild(extensionSpan);
        resultItem.appendChild(fileSizeSpan);
        resultItem.appendChild(statusSpan);

        this.testResults.appendChild(resultItem);
    }

    addClearButton() {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-results-btn';
        clearBtn.textContent = '결과 지우기';
        clearBtn.addEventListener('click', () => this.clearTestResults());

        this.testResults.appendChild(clearBtn);
    }

    clearTestResults() {
        this.testResults.innerHTML = '';
    }

    renderFixedExtensions(extensions) {
        this.fixedExtensionsContainer.innerHTML = '';

        extensions.forEach(ext => {
            const item = document.createElement('div');
            item.className = 'extension-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `fixed-${ext.name}`;
            checkbox.checked = ext.blocked;
            checkbox.addEventListener('change', () => this.toggleFixedExtension(ext.name, checkbox.checked));

            const label = document.createElement('label');
            label.htmlFor = `fixed-${ext.name}`;
            label.textContent = ext.name;

            item.appendChild(checkbox);
            item.appendChild(label);
            this.fixedExtensionsContainer.appendChild(item);
        });
    }

    renderCustomExtensions(extensions) {
        this.customExtensionsContainer.innerHTML = '';

        if (extensions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = '추가된 커스텀 확장자가 없습니다.';
            this.customExtensionsContainer.appendChild(emptyMessage);
            return;
        }

        extensions.forEach(ext => {
            const tag = document.createElement('div');
            tag.className = 'custom-extension-tag';

            const name = document.createElement('span');
            name.className = 'extension-name';
            name.textContent = ext;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.title = '삭제';
            removeBtn.addEventListener('click', () => this.removeCustomExtension(ext));

            tag.appendChild(name);
            tag.appendChild(removeBtn);
            this.customExtensionsContainer.appendChild(tag);
        });
    }

    updateCustomCount(count) {
        this.customCountElement.textContent = count;

        if (count >= 200) {
            this.customInput.disabled = true;
            this.addButton.disabled = true;
            this.showError('커스텀 확장자는 최대 200개까지만 추가할 수 있습니다.');
        } else {
            this.customInput.disabled = false;
            this.validateInput();
        }
    }

    async toggleFixedExtension(extensionName, blocked) {
        try {
            const response = await fetch(`${this.baseUrl}/fixed/${extensionName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ blocked })
            });

            if (!response.ok) {
                throw new Error('Failed to update extension');
            }

            // 로컬 데이터 즉시 업데이트
            if (this.currentExtensionData && this.currentExtensionData.fixedExtensions) {
                const extension = this.currentExtensionData.fixedExtensions.find(ext => ext.name === extensionName);
                if (extension) {
                    extension.blocked = blocked;
                }
            }

            this.showSuccess(`${extensionName} 확장자가 ${blocked ? '차단' : '허용'}되었습니다.`);
        } catch (error) {
            this.showError('확장자 설정 변경에 실패했습니다.');
            console.error('Error updating fixed extension:', error);
            await this.loadData();
        }
    }

    async addCustomExtension() {
        const extension = this.customInput.value.trim().toLowerCase();

        if (!this.validateExtensionInput(extension)) return;

        try {
            const response = await fetch(`${this.baseUrl}/custom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ extension })
            });

            const result = await response.json();

            if (!response.ok) {
                this.showError(this.getErrorMessage(result.error));
                return;
            }

            // 로컬 데이터 즉시 업데이트
            if (this.currentExtensionData && this.currentExtensionData.customExtensions) {
                this.currentExtensionData.customExtensions.push(extension);
                this.currentExtensionData.customExtensions.sort();
            }

            this.customInput.value = '';
            this.validateInput();
            await this.loadData();
            this.showSuccess(`${extension} 확장자가 추가되었습니다.`);
        } catch (error) {
            this.showError('확장자 추가에 실패했습니다.');
            console.error('Error adding custom extension:', error);
        }
    }

    async removeCustomExtension(extension) {
        if (!confirm(`${extension} 확장자를 삭제하시겠습니까?`)) return;

        try {
            const response = await fetch(`${this.baseUrl}/custom/${extension}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete extension');
            }

            // 로컬 데이터 즉시 업데이트
            if (this.currentExtensionData && this.currentExtensionData.customExtensions) {
                const index = this.currentExtensionData.customExtensions.indexOf(extension);
                if (index > -1) {
                    this.currentExtensionData.customExtensions.splice(index, 1);
                }
            }

            await this.loadData();
            this.showSuccess(`${extension} 확장자가 삭제되었습니다.`);
        } catch (error) {
            this.showError('확장자 삭제에 실패했습니다.');
            console.error('Error removing custom extension:', error);
        }
    }

    validateExtensionInput(extension) {
        if (!extension) {
            this.showError('확장자를 입력해주세요.');
            return false;
        }

        if (extension.length > 20) {
            this.showError('확장자는 최대 20자까지 입력 가능합니다.');
            return false;
        }

        if (!/^[a-z0-9]+$/i.test(extension)) {
            this.showError('확장자는 영문자와 숫자만 입력 가능합니다.');
            return false;
        }

        return true;
    }

    getErrorMessage(error) {
        const errorMessages = {
            'Invalid extension length': '확장자 길이가 유효하지 않습니다.',
            'Maximum custom extensions limit reached': '커스텀 확장자는 최대 200개까지만 추가할 수 있습니다.',
            'Extension already exists': '이미 추가된 확장자입니다.',
            'Extension not found': '확장자를 찾을 수 없습니다.'
        };

        return errorMessages[error] || '알 수 없는 오류가 발생했습니다.';
    }

    showToast(message, type = 'success', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '✓' : '✕';

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
            <div class="toast-progress"></div>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        const progressBar = toast.querySelector('.toast-progress');
        progressBar.style.width = '100%';
        progressBar.style.transitionDuration = `${duration}ms`;

        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 200);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }
        }, duration);

        return toast;
    }

    showError(message) {
        this.showToast(message, 'error', 5000);
    }

    showSuccess(message) {
        this.showToast(message, 'success', 3000);
    }

    removeMessages() {
        // 토스트 시스템에서는 자동으로 제거되므로 빈 함수로 유지
    }

    async loadFileSizeLimit() {
        try {
            const response = await fetch('/api/settings/file-size-limit');
            if (!response.ok) throw new Error('Failed to load file size limit');

            const data = await response.json();
            this.updateFileSizeLimitDisplay(data.fileSizeLimit);

            // currentExtensionData에도 저장
            if (this.currentExtensionData) {
                this.currentExtensionData.fileSizeLimit = data.fileSizeLimit;
            }

        } catch (error) {
            console.error('Error loading file size limit:', error);
            this.updateFileSizeLimitDisplay(0);
        }
    }

    async saveFileSizeLimit() {
        const limitValue = parseInt(this.fileSizeLimitInput.value) || 0;

        if (limitValue < 0 || limitValue > 1024) {
            this.showError('파일 크기 제한은 0-1024 MB 사이여야 합니다.');
            return;
        }

        try {
            const response = await fetch('/api/settings/file-size-limit', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: limitValue })
            });

            if (!response.ok) {
                throw new Error('Failed to save file size limit');
            }

            // 로컬 데이터 즉시 업데이트
            if (this.currentExtensionData) {
                this.currentExtensionData.fileSizeLimit = limitValue;
            }

            this.updateFileSizeLimitDisplay(limitValue);
            this.fileSizeLimitInput.value = '';

            if (limitValue === 0) {
                this.showSuccess('파일 크기 제한이 해제되었습니다.');
            } else {
                this.showSuccess(`파일 크기 제한이 ${limitValue}MB로 설정되었습니다.`);
            }

        } catch (error) {
            this.showError('파일 크기 제한 설정에 실패했습니다.');
            console.error('Error saving file size limit:', error);
        }
    }

    updateFileSizeLimitDisplay(limit) {
        if (limit === 0) {
            this.currentSizeLimitSpan.textContent = '현재 제한: 제한 없음';
        } else {
            this.currentSizeLimitSpan.textContent = `현재 제한: ${limit}MB`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FileExtensionBlocker();
});