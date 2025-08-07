// 术语管理系统前端脚本

document.addEventListener('DOMContentLoaded', function() {
    // 初始化所有功能
    initSearchFunctionality();
    initFormValidation();
    initTooltips();
    initConfirmDialogs();
    initAutoSave();
    initThemeToggle();
});

// 搜索功能
function initSearchFunctionality() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const languageFilter = document.getElementById('languageFilter');

    if (searchForm) {
        // 实时搜索
        let searchTimeout;
        searchInput?.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch();
            }, 500);
        });

        // 筛选器变化时搜索
        categoryFilter?.addEventListener('change', performSearch);
        languageFilter?.addEventListener('change', performSearch);

        // 表单提交
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performSearch();
        });
    }
}

// 执行搜索
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const languageFilter = document.getElementById('languageFilter');
    const resultsContainer = document.getElementById('searchResults');

    if (!resultsContainer) return;

    const searchData = {
        query: searchInput?.value || '',
        category: categoryFilter?.value || '',
        language: languageFilter?.value || ''
    };

    // 显示加载状态
    resultsContainer.innerHTML = '<div class="text-center"><div class="loading"></div> 搜索中...</div>';

    // 发送搜索请求
    fetch('/api/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData)
    })
    .then(response => response.json())
    .then(data => {
        displaySearchResults(data.results);
    })
    .catch(error => {
        console.error('搜索错误:', error);
        resultsContainer.innerHTML = '<div class="alert alert-danger">搜索失败，请重试</div>';
    });
}

// 显示搜索结果
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="alert alert-info">未找到相关术语</div>';
        return;
    }

    let html = '<div class="row">';
    results.forEach(term => {
        html += `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${highlightSearchTerm(term.term)}</h5>
                        <p class="card-text">${highlightSearchTerm(term.definition)}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">
                                <i class="fas fa-tag"></i> ${term.category}
                            </small>
                            <small class="text-muted">
                                <i class="fas fa-language"></i> ${term.language}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    resultsContainer.innerHTML = html;
}

// 高亮搜索词
function highlightSearchTerm(text) {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput?.value.trim();
    
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// 表单验证
function initFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
}

// 初始化工具提示
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// 确认对话框
function initConfirmDialogs() {
    const deleteButtons = document.querySelectorAll('.btn-delete');
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const message = this.dataset.message || '确定要删除吗？';
            
            if (confirm(message)) {
                const form = this.closest('form');
                if (form) {
                    form.submit();
                } else {
                    window.location.href = this.href;
                }
            }
        });
    });
}

// 自动保存功能
function initAutoSave() {
    const autoSaveForms = document.querySelectorAll('.auto-save');
    
    autoSaveForms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(() => {
                    autoSaveForm(form);
                }, 2000);
            });
        });
    });
}

// 执行自动保存
function autoSaveForm(form) {
    const formData = new FormData(form);
    
    fetch('/api/auto-save', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('已自动保存', 'success');
        }
    })
    .catch(error => {
        console.error('自动保存失败:', error);
    });
}

// 主题切换
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.body.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
            
            // 更新图标
            const icon = this.querySelector('i');
            if (newTheme === 'dark') {
                icon.className = 'fas fa-sun';
            } else {
                icon.className = 'fas fa-moon';
            }
        });
        
        // 加载保存的主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.dataset.theme = savedTheme;
        
        const icon = themeToggle.querySelector('i');
        if (savedTheme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showNotification('复制失败', 'danger');
    });
}

// 导出数据
function exportData(format = 'json') {
    fetch(`/api/export?format=${format}`)
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminology_export_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification('导出成功', 'success');
    })
    .catch(error => {
        console.error('导出失败:', error);
        showNotification('导出失败', 'danger');
    });
}

// 批量操作
function initBatchOperations() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const itemCheckboxes = document.querySelectorAll('.item-checkbox');
    const batchActions = document.getElementById('batchActions');
    
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            itemCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateBatchActions();
        });
    }
    
    itemCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateBatchActions);
    });
    
    function updateBatchActions() {
        const checkedItems = document.querySelectorAll('.item-checkbox:checked');
        if (batchActions) {
            batchActions.style.display = checkedItems.length > 0 ? 'block' : 'none';
        }
    }
}

// 实时统计更新
function updateStats() {
    fetch('/api/stats')
    .then(response => response.json())
    .then(data => {
        // 更新统计数据
        const statsElements = document.querySelectorAll('[data-stat]');
        statsElements.forEach(element => {
            const statType = element.dataset.stat;
            if (data[statType] !== undefined) {
                element.textContent = data[statType];
            }
        });
    })
    .catch(error => {
        console.error('统计数据更新失败:', error);
    });
}

// 定期更新统计数据
setInterval(updateStats, 30000); // 每30秒更新一次
