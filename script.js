// Database configuration
const DB_NAME = 'RabindraInfoTechDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

// File size limit (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'video/mp4': 'mp4'
};

class DocumentManager {
    constructor() {
        this.db = null;
        this.currentDate = new Date();
        this.currentEntryId = null;
        this.initDB().then(() => {
            this.initUI();
            this.loadEntries();
            this.loadTags();
        });
    }

    async initDB() {
        try {
            this.db = await idb.openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        store.createIndex('date', 'date');
                        store.createIndex('type', 'type');
                        store.createIndex('tags', 'tags', { multiEntry: true });
                    }
                }
            });
        } catch (error) {
            console.error('Error opening DB:', error);
            this.showToast('Error', 'Failed to initialize database', 'danger');
            // Fallback to localStorage if IndexedDB fails
            this.useLocalStorage = true;
        }
    }

    initUI() {
        // Initialize calendar
        this.renderCalendar(this.currentDate);

        // Set current date display
        this.updateCurrentDateDisplay();

        // Event listeners
        document.getElementById('uploadBtn').addEventListener('click', () => this.handleUpload());
        document.getElementById('searchInput').addEventListener('input', () => this.loadEntries());
        document.getElementById('typeFilter').addEventListener('change', () => this.loadEntries());
        document.getElementById('tagFilter').addEventListener('change', () => this.loadEntries());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());

        // Initialize Bootstrap tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    async loadEntries() {
        const entriesList = document.getElementById('entriesList');
        entriesList.innerHTML = '<div class="text-center py-5" id="loadingIndicator"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

        try {
            let entries = await this.getAllEntries();
            
            // Apply filters
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const typeFilter = document.getElementById('typeFilter').value;
            const tagFilter = document.getElementById('tagFilter').value;
            
            entries = entries.filter(entry => {
                const matchesSearch = searchTerm === '' || 
                    entry.title.toLowerCase().includes(searchTerm) || 
                    (entry.description && entry.description.toLowerCase().includes(searchTerm));
                
                const matchesType = typeFilter === 'all' || entry.type === typeFilter;
                
                const matchesTag = tagFilter === 'all' || 
                    (entry.tags && entry.tags.some(tag => tag.toLowerCase() === tagFilter.toLowerCase()));
                
                return matchesSearch && matchesType && matchesTag;
            });

            // Sort by date (newest first)
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));

            this.displayEntries(entries);
        } catch (error) {
            console.error('Error loading entries:', error);
            entriesList.innerHTML = '<div class="alert alert-danger">Failed to load entries</div>';
            this.showToast('Error', 'Failed to load entries', 'danger');
        }
    }

    async getAllEntries() {
        if (this.useLocalStorage) {
            return this.getEntriesFromLocalStorage();
        } else {
            return await this.db.getAll(STORE_NAME);
        }
    }

    async getEntriesFromLocalStorage() {
        const entries = localStorage.getItem(STORE_NAME);
        return entries ? JSON.parse(entries) : [];
    }

    displayEntries(entries) {
        const entriesList = document.getElementById('entriesList');
        
        if (entries.length === 0) {
            entriesList.innerHTML = '<div class="alert alert-info">No entries found</div>';
            return;
        }

        entriesList.innerHTML = '';

        entries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const formattedDate = entryDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const entryElement = document.createElement('div');
            entryElement.className = 'list-group-item entry-item py-3';
            entryElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="flex-shrink-0 me-3">
                        ${this.getFileThumbnail(entry)}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${entry.title}</h6>
                        <small class="text-muted">${formattedDate}</small>
                        ${entry.description ? `<p class="mb-1 mt-1 small">${entry.description}</p>` : ''}
                        ${entry.tags && entry.tags.length > 0 ? 
                            `<div class="mt-1">${entry.tags.map(tag => `<span class="badge tag-badge">${tag}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="flex-shrink-0">
                        <button class="btn btn-sm btn-outline-primary preview-btn" data-id="${entry.id}" data-bs-toggle="tooltip" title="Preview">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="${entry.id}" data-bs-toggle="tooltip" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${entry.id}" data-bs-toggle="tooltip" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            entriesList.appendChild(entryElement);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.previewEntry(e.target.closest('button').dataset.id));
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.editEntry(e.target.closest('button').dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteEntry(e.target.closest('button').dataset.id));
        });
    }

    getFileThumbnail(entry) {
        if (entry.type === 'image') {
            return `<img src="${entry.fileData}" class="entry-thumbnail" alt="${entry.title}">`;
        } else if (entry.type === 'video') {
            return `<div class="video-thumbnail entry-thumbnail bg-secondary d-flex align-items-center justify-content-center">
                <i class="bi bi-film text-white"></i>
            </div>`;
        } else {
            let iconClass = 'bi-file-earmark';
            if (entry.fileType === 'pdf') iconClass = 'bi-file-earmark-pdf pdf-icon';
            else if (entry.fileType === 'docx') iconClass = 'bi-file-earmark-word word-icon';
            else if (entry.fileType === 'txt') iconClass = 'bi-file-earmark-text text-icon';
            
            return `<div class="file-icon">
                <i class="bi ${iconClass}"></i>
            </div>`;
        }
    }

    async previewEntry(id) {
        try {
            const entry = await this.getEntryById(id);
            if (!entry) {
                this.showToast('Error', 'Entry not found', 'danger');
                return;
            }

            document.getElementById('previewModalTitle').textContent = entry.title;
            const previewContent = document.getElementById('previewModalContent');
            previewContent.innerHTML = '';

            const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
            
            if (entry.type === 'image') {
                previewContent.innerHTML = `<img src="${entry.fileData}" class="img-fluid" alt="${entry.title}">`;
            } else if (entry.type === 'video') {
                previewContent.innerHTML = `
                    <video controls class="w-100">
                        <source src="${entry.fileData}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            } else {
                previewContent.innerHTML = `
                    <div class="text-center py-4">
                        <div class="file-icon mb-3">
                            ${this.getFileThumbnail(entry)}
                        </div>
                        <p>This file cannot be previewed in the browser.</p>
                        <a href="${entry.fileData}" download="${entry.fileName}" class="btn btn-primary">
                            <i class="bi bi-download"></i> Download File
                        </a>
                    </div>
                `;
            }

            // Set up download button
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.onclick = () => {
                this.downloadFile(entry);
                previewModal.hide();
            };

            previewModal.show();
        } catch (error) {
            console.error('Error previewing entry:', error);
            this.showToast('Error', 'Failed to preview entry', 'danger');
        }
    }

    downloadFile(entry) {
        const link = document.createElement('a');
        link.href = entry.fileData;
        link.download = entry.fileName || `download.${entry.fileType}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Success', 'Download started', 'success');
    }

    async editEntry(id) {
        try {
            const entry = await this.getEntryById(id);
            if (!entry) {
                this.showToast('Error', 'Entry not found', 'danger');
                return;
            }

            this.currentEntryId = id;
            
            // Fill the form with entry data
            document.getElementById('titleInput').value = entry.title;
            document.getElementById('descriptionInput').value = entry.description || '';
            document.getElementById('tagsInput').value = entry.tags ? entry.tags.join(', ') : '';
            
            // Show the upload modal (we'll use it for editing too)
            const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
            uploadModal.show();
            
            // Change the modal title and button text
            document.getElementById('uploadModalLabel').textContent = 'Edit Entry';
            document.getElementById('uploadBtn').textContent = 'Save Changes';
            
            // We won't pre-fill the file input as it's complicated to set programmatically
            document.getElementById('fileInput').value = '';
        } catch (error) {
            console.error('Error editing entry:', error);
            this.showToast('Error', 'Failed to edit entry', 'danger');
        }
    }

    async deleteEntry(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        
        try {
            await this.removeEntry(id);
            this.showToast('Success', 'Entry deleted successfully', 'success');
            this.loadEntries();
            this.loadTags();
            this.renderCalendar(this.currentDate);
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showToast('Error', 'Failed to delete entry', 'danger');
        }
    }

    async handleUpload() {
        const fileInput = document.getElementById('fileInput');
        const titleInput = document.getElementById('titleInput');
        const descriptionInput = document.getElementById('descriptionInput');
        const tagsInput = document.getElementById('tagsInput');
        
        // Validate inputs
        if (!fileInput.files || fileInput.files.length === 0) {
            this.showToast('Error', 'Please select a file', 'danger');
            return;
        }
        
        if (!titleInput.value.trim()) {
            this.showToast('Error', 'Please enter a title', 'danger');
            titleInput.focus();
            return;
        }
        
        const file = fileInput.files[0];
        
        // Validate file type
        if (!ALLOWED_TYPES[file.type]) {
            this.showToast('Error', 'File type not allowed', 'danger');
            return;
        }
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            this.showToast('Error', 'File size exceeds 10MB limit', 'danger');
            return;
        }
        
        // Determine file type category
        let fileCategory;
        if (file.type.startsWith('image/')) fileCategory = 'image';
        else if (file.type.startsWith('video/')) fileCategory = 'video';
        else fileCategory = 'document';
        
        // Process tags
        const tags = tagsInput.value 
            ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag)
            : [];
        
        try {
            // Read file as data URL
            const fileData = await this.readFileAsDataURL(file);
            
            const entry = {
                title: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                tags,
                fileName: file.name,
                fileType: ALLOWED_TYPES[file.type],
                type: fileCategory,
                fileData,
                date: new Date().toISOString()
            };
            
            if (this.currentEntryId) {
                // Update existing entry
                entry.id = parseInt(this.currentEntryId);
                await this.updateEntry(entry);
                this.showToast('Success', 'Entry updated successfully', 'success');
            } else {
                // Add new entry
                await this.addEntry(entry);
                this.showToast('Success', 'File uploaded successfully', 'success');
            }
            
            // Reset form and close modal
            this.resetForm();
            bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
            
            // Refresh UI
            this.loadEntries();
            this.loadTags();
            this.renderCalendar(this.currentDate);
        } catch (error) {
            console.error('Error handling upload:', error);
            this.showToast('Error', 'Failed to process file', 'danger');
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    resetForm() {
        document.getElementById('uploadForm').reset();
        this.currentEntryId = null;
        document.getElementById('uploadModalLabel').textContent = 'Upload New File';
        document.getElementById('uploadBtn').textContent = 'Upload';
    }

    async addEntry(entry) {
        if (this.useLocalStorage) {
            return this.addEntryToLocalStorage(entry);
        } else {
            return await this.db.add(STORE_NAME, entry);
        }
    }

    async addEntryToLocalStorage(entry) {
        const entries = await this.getEntriesFromLocalStorage();
        entry.id = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;
        entries.push(entry);
        localStorage.setItem(STORE_NAME, JSON.stringify(entries));
        return entry.id;
    }

    async updateEntry(entry) {
        if (this.useLocalStorage) {
            return this.updateEntryInLocalStorage(entry);
        } else {
            return await this.db.put(STORE_NAME, entry);
        }
    }

    async updateEntryInLocalStorage(entry) {
        const entries = await this.getEntriesFromLocalStorage();
        const index = entries.findIndex(e => e.id === entry.id);
        if (index !== -1) {
            entries[index] = entry;
            localStorage.setItem(STORE_NAME, JSON.stringify(entries));
        }
    }

    async removeEntry(id) {
        if (this.useLocalStorage) {
            return this.removeEntryFromLocalStorage(id);
        } else {
            return await this.db.delete(STORE_NAME, parseInt(id));
        }
    }

    async removeEntryFromLocalStorage(id) {
        const entries = await this.getEntriesFromLocalStorage();
        const filteredEntries = entries.filter(e => e.id !== parseInt(id));
        localStorage.setItem(STORE_NAME, JSON.stringify(filteredEntries));
    }

    async getEntryById(id) {
        if (this.useLocalStorage) {
            const entries = await this.getEntriesFromLocalStorage();
            return entries.find(e => e.id === parseInt(id));
        } else {
            return await this.db.get(STORE_NAME, parseInt(id));
        }
    }

    renderCalendar(date) {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Get first day of month and total days in month
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Get days from previous month to show
        const prevMonthDays = new Date(year, month, 0).getDate();
        
        // Create calendar header
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const headerHTML = `
            <div class="calendar-header">
                <button class="btn btn-sm btn-outline-secondary prev-month"><i class="bi bi-chevron-left"></i></button>
                <h6 class="mb-0">${monthNames[month]} ${year}</h6>
                <button class="btn btn-sm btn-outline-secondary next-month"><i class="bi bi-chevron-right"></i></button>
            </div>
        `;
        
        // Create day names header
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNamesHTML = `
            <div class="calendar-days">
                ${dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}
            </div>
        `;
        
        // Create calendar dates grid
        let datesHTML = '<div class="calendar-dates">';
        
        // Add days from previous month
        for (let i = 0; i < firstDay; i++) {
            datesHTML += `<div class="calendar-date text-muted">${prevMonthDays - firstDay + i + 1}</div>`;
        }
        
        // Add days from current month
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            const dateClass = this.isToday(currentDate) ? 'today' : '';
            const hasEntriesClass = this.doesDateHaveEntries(currentDate) ? 'has-entries' : '';
            
            datesHTML += `<div class="calendar-date ${dateClass} ${hasEntriesClass}" data-date="${currentDate.toISOString()}">${i}</div>`;
        }
        
        // Add days from next month to complete the grid
        const totalCells = firstDay + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        
        for (let i = 1; i <= remainingCells; i++) {
            datesHTML += `<div class="calendar-date text-muted">${i}</div>`;
        }
        
        datesHTML += '</div>';
        
        // Combine all parts
        calendarEl.innerHTML = headerHTML + dayNamesHTML + datesHTML;
        
        // Add event listeners
        document.querySelector('.prev-month').addEventListener('click', () => {
            this.currentDate = new Date(year, month - 1, 1);
            this.renderCalendar(this.currentDate);
        });
        
        document.querySelector('.next-month').addEventListener('click', () => {
            this.currentDate = new Date(year, month + 1, 1);
            this.renderCalendar(this.currentDate);
        });
        
        document.querySelectorAll('.calendar-date[data-date]').forEach(dateEl => {
            dateEl.addEventListener('click', () => {
                const date = new Date(dateEl.dataset.date);
                this.currentDate = date;
                this.updateCurrentDateDisplay();
                this.loadEntries();
                
                // Update selected date in calendar
                document.querySelectorAll('.calendar-date').forEach(el => el.classList.remove('selected'));
                dateEl.classList.add('selected');
            });
        });
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }

    async doesDateHaveEntries(date) {
        try {
            const entries = await this.getAllEntries();
            if (!entries || entries.length === 0) return false;
            
            const dateStr = date.toISOString().split('T')[0];
            
            return entries.some(entry => {
                const entryDateStr = entry.date.split('T')[0];
                return entryDateStr === dateStr;
            });
        } catch (error) {
            console.error('Error checking date entries:', error);
            return false;
        }
    }

    updateCurrentDateDisplay() {
        const currentDateEl = document.getElementById('currentDate');
        if (currentDateEl) {
            currentDateEl.textContent = this.currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    async loadTags() {
        try {
            const entries = await this.getAllEntries();
            const tags = new Set();
            
            entries.forEach(entry => {
                if (entry.tags && entry.tags.length > 0) {
                    entry.tags.forEach(tag => tags.add(tag.toLowerCase()));
                }
            });
            
            const tagFilter = document.getElementById('tagFilter');
            const currentTag = tagFilter.value;
            
            // Clear existing options except "All Tags"
            tagFilter.innerHTML = '<option value="all">All Tags</option>';
            
            // Add tags sorted alphabetically
            Array.from(tags).sort().forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter.appendChild(option);
            });
            
            // Restore selected tag if it still exists
            if (currentTag !== 'all' && tags.has(currentTag.toLowerCase())) {
                tagFilter.value = currentTag;
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('tagFilter').value = 'all';
        this.loadEntries();
    }

    showToast(title, message, type = 'info') {
        const toastEl = document.getElementById('toastNotification');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        
        // Set toast content
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Set toast color based on type
        const toast = new bootstrap.Toast(toastEl);
        toastEl.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');
        
        switch (type) {
            case 'success':
                toastEl.classList.add('bg-success');
                break;
            case 'danger':
                toastEl.classList.add('bg-danger');
                break;
            case 'warning':
                toastEl.classList.add('bg-warning');
                break;
            case 'info':
                toastEl.classList.add('bg-info');
                break;
            default:
                toastEl.classList.add('bg-primary');
        }
        
        toast.show();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DocumentManager();
});