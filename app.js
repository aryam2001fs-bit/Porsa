/* ========================================
   پرسا - اپلیکیشن پرسشنامه‌ساز حرفه‌ای
   Porsa Survey Builder v2.1
   ======================================== */

// ---------- داده‌های اصلی ----------
let questionnaires = [];
let responses = {};
let currentEditId = null, currentRespondId = null;
let autoSaveTimer = null;
let builderAutoSaveTimer = null;
let undoStack = [];
let maxUndoSteps = 20;

// ---------- کلیدهای ذخیره‌سازی ----------
const STORAGE_QS = "porsa_questionnaires";
const STORAGE_RESP = "porsa_responses";
const STORAGE_THEME = "porsa_theme";
const DRAFT_PREFIX = "porsa_draft_";
const BUILDER_DRAFT_PREFIX = "porsa_builder_draft_";
const SAMPLE_FLAG = "porsa_sample_created";

// ---------- مقادیر پیش‌فرض ----------
const DEFAULT_PRIMARY = "#2c6e9e";
const DEFAULT_CARD_BG = "#ffffff";
const DEFAULT_TEXT_COLOR = "#1e293b";

// ========================================
//   توابع کمکی
// ========================================

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast glass show' + (isError ? ' error' : '');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

function saveAll() {
    localStorage.setItem(STORAGE_QS, JSON.stringify(questionnaires));
    localStorage.setItem(STORAGE_RESP, JSON.stringify(responses));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

function getTypeName(t) {
    const types = {
        text: 'متن کوتاه', textarea: 'متن بلند', number: 'عدد',
        radio: 'چند گزینه‌ای (تک انتخابی)', checkbox: 'چند گزینه‌ای (چند انتخابی)',
        select: 'لیست کشویی', likert: 'مقیاس لیکرت', date: 'تاریخ'
    };
    return types[t] || t;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToDashboard() {
    showPage('dashboardPage');
    renderDashboard();
}

// ---------- تابع کمکی برای آیکون ----------
function icon(name) {
    return `<img src="images/${name}.png" alt="" class="icon-img">`;
}

// ========================================
//   Undo (بازگردانی)
// ========================================

function pushUndo() {
    const state = JSON.stringify(tempSections);
    undoStack.push(state);
    if (undoStack.length > maxUndoSteps) undoStack.shift();
}

function undo() {
    if (undoStack.length === 0) {
        showToast('چیزی برای بازگردانی نیست', true);
        return;
    }
    const state = undoStack.pop();
    tempSections = JSON.parse(state);
    renderBuilderSections();
    showToast('بازگردانی انجام شد');
}

// ========================================
//   مدال‌های سفارشی
// ========================================

function showConfirmModal(message, onConfirm, onCancel = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:12px;">${icon('warning')}</div>
            <p style="font-size:1.05rem;margin-bottom:20px;line-height:1.6;">${escapeHtml(message)}</p>
            <div class="flex-between" style="justify-content:center;gap:12px;">
                <button class="btn btn-secondary" id="modalCancelBtn">انصراف</button>
                <button class="btn btn-danger" id="modalConfirmBtn">تأیید</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('modalCancelBtn').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
    document.getElementById('modalConfirmBtn').onclick = () => {
        overlay.remove();
        onConfirm();
    };
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    };
}

function showPromptModal(message, defaultValue, onConfirm, onCancel = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:400px;">
            <p style="font-size:1.05rem;margin-bottom:16px;line-height:1.6;">${escapeHtml(message)}</p>
            <input type="text" id="promptInput" value="${escapeHtml(defaultValue || '')}" class="glass-input" style="margin-bottom:16px;">
            <div class="flex-between" style="justify-content:center;gap:12px;">
                <button class="btn btn-secondary" id="promptCancelBtn">انصراف</button>
                <button class="btn btn-primary" id="promptConfirmBtn">تأیید</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const input = document.getElementById('promptInput');
    input.focus();
    input.select();

    const confirm = () => {
        const val = input.value.trim();
        overlay.remove();
        onConfirm(val);
    };

    document.getElementById('promptCancelBtn').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
    document.getElementById('promptConfirmBtn').onclick = confirm;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    };
}

// ========================================
//   پرسشنامه نمونه
// ========================================

function createSampleOnce() {
    if (localStorage.getItem(SAMPLE_FLAG) === "true") return;
    const sampleId = 1000001;
    if (questionnaires.some(q => q.id === sampleId)) {
        localStorage.setItem(SAMPLE_FLAG, "true");
        return;
    }
    questionnaires.push({
        id: sampleId,
        name: "پرسشنامه نمونه",
        sections: [
            {
                title: "اطلاعات دموگرافیک", questions: [
                    { id: "s1q1", label: "کد یکتای شرکت‌کننده (شماره)", type: "number", options: undefined, required: true, condition: null, min: 1, max: 99999, step: 1 },
                    { id: "s1q2", label: "جنسیت", type: "radio", options: [{ text: "مرد", code: 1 }, { text: "زن", code: 2 }], required: true, condition: null },
                    { id: "s1q3", label: "سن", type: "number", options: undefined, required: true, condition: null, min: 18, max: 120, step: 1 }
                ]
            },
            {
                title: "سبک زندگی", questions: [
                    { id: "s2q1", label: "آیا سیگار می‌کشید؟", type: "radio", options: [{ text: "بله", code: 1 }, { text: "خیر", code: 0 }], required: true, condition: null },
                    { id: "s2q2", label: "چند نخ در روز؟", type: "number", options: undefined, required: false, condition: { sourceId: "s2q1", operator: "equals", value: "1" }, min: 0, max: 100, step: 1 }
                ]
            },
            {
                title: "رضایت", questions: [
                    { id: "s3q1", label: "رضایت کلی از خدمات", type: "likert", options: [{ text: "خیلی کم", code: 1 }, { text: "کم", code: 2 }, { text: "متوسط", code: 3 }, { text: "زیاد", code: 4 }, { text: "خیلی زیاد", code: 5 }], required: true, condition: null }
                ]
            }
        ]
    });
    saveAll();
    localStorage.setItem(SAMPLE_FLAG, "true");
}

function restoreSampleManually() {
    const sampleId = 1000001;
    if (questionnaires.some(q => q.id === sampleId)) {
        showToast('پرسشنامه نمونه از قبل وجود دارد', true);
        return;
    }
    questionnaires.push({
        id: sampleId,
        name: "پرسشنامه نمونه",
        sections: [
            {
                title: "اطلاعات دموگرافیک", questions: [
                    { id: "s1q1", label: "کد یکتای شرکت‌کننده (شماره)", type: "number", options: undefined, required: true, condition: null, min: 1, max: 99999, step: 1 },
                    { id: "s1q2", label: "جنسیت", type: "radio", options: [{ text: "مرد", code: 1 }, { text: "زن", code: 2 }], required: true, condition: null },
                    { id: "s1q3", label: "سن", type: "number", options: undefined, required: true, condition: null, min: 18, max: 120, step: 1 }
                ]
            },
            {
                title: "سبک زندگی", questions: [
                    { id: "s2q1", label: "آیا سیگار می‌کشید؟", type: "radio", options: [{ text: "بله", code: 1 }, { text: "خیر", code: 0 }], required: true, condition: null },
                    { id: "s2q2", label: "چند نخ در روز؟", type: "number", options: undefined, required: false, condition: { sourceId: "s2q1", operator: "equals", value: "1" }, min: 0, max: 100, step: 1 }
                ]
            },
            {
                title: "رضایت", questions: [
                    { id: "s3q1", label: "رضایت کلی از خدمات", type: "likert", options: [{ text: "خیلی کم", code: 1 }, { text: "کم", code: 2 }, { text: "متوسط", code: 3 }, { text: "زیاد", code: 4 }, { text: "خیلی زیاد", code: 5 }], required: true, condition: null }
                ]
            }
        ]
    });
    saveAll();
    renderDashboard();
    showToast('پرسشنامه نمونه بازگردانی شد');
}

// ========================================
//   داشبورد
// ========================================

function renderDashboard(filterText = '') {
    const container = document.getElementById('questionnairesList');
    let filtered = questionnaires;
    if (filterText) {
        const search = filterText.toLowerCase();
        filtered = questionnaires.filter(q =>
            q.name.toLowerCase().includes(search) ||
            q.sections.some(s => s.title.toLowerCase().includes(search))
        );
    }

    if (!filtered.length) {
        container.innerHTML = `<div class="card glass text-center" style="padding:40px;grid-column:1/-1;">
            <div style="font-size:2.5rem;margin-bottom:8px;">${icon('empty')}</div>
            <p style="font-size:1.1rem;color:var(--text-secondary);">${filterText ? 'نتیجه‌ای یافت نشد' : 'هیچ پرسشنامه‌ای ساخته نشده.'}</p>
        </div>`;
        return;
    }

    container.innerHTML = '';
    filtered.forEach((q, idx) => {
        const respCount = responses[q.id] ? responses[q.id].length : 0;
        const card = document.createElement('div');
        card.className = 'questionnaire-card glass';
        card.style.animationDelay = `${idx * 0.05}s`;
        card.innerHTML = `
            <h3>${escapeHtml(q.name)}</h3>
            <p>تعداد پاسخ: ${respCount} | بخش‌ها: ${q.sections.length}</p>
            <div class="flex-between mt-3" style="gap:6px;flex-wrap:wrap;">
                <div class="tooltip-container">
                    <button class="btn btn-sm edit-structure glass-btn" data-id="${q.id}"><img src="images/edit.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">ویرایش ساختار</span>
                </div>
                <div class="tooltip-container">
                    <button class="btn btn-sm respond glass-btn" data-id="${q.id}"><img src="images/form.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">پاسخگویی</span>
                </div>
                <div class="tooltip-container">
                    <button class="btn btn-sm view-data glass-btn" data-id="${q.id}"><img src="images/chart.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">داده‌ها</span>
                </div>
                <div class="tooltip-container">
                    <button class="btn btn-sm delete-qs glass-btn" data-id="${q.id}"><img src="images/delete.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">حذف</span>
                </div>
            </div>`;
        container.appendChild(card);
    });

    document.querySelectorAll('.edit-structure').forEach(btn =>
        btn.addEventListener('click', () => openBuilder(parseInt(btn.dataset.id))));
    document.querySelectorAll('.respond').forEach(btn =>
        btn.addEventListener('click', () => openRespond(parseInt(btn.dataset.id))));
    document.querySelectorAll('.view-data').forEach(btn =>
        btn.addEventListener('click', () => openData(parseInt(btn.dataset.id))));
    document.querySelectorAll('.delete-qs').forEach(btn =>
        btn.addEventListener('click', () => {
            showConfirmModal('آیا پرسشنامه و تمام پاسخ‌های آن حذف شود؟', () => {
                const id = parseInt(btn.dataset.id);
                questionnaires = questionnaires.filter(q => q.id !== id);
                delete responses[id];
                saveAll();
                renderDashboard(document.getElementById('searchInput').value);
                showToast('پرسشنامه حذف شد');
            });
        }));
}

// ========================================
//   سازنده پرسشنامه
// ========================================

let tempSections = [];

function openBuilder(id = null) {
    currentEditId = id;
    const q = id ? questionnaires.find(q => q.id === id) : null;
    document.getElementById('builderTitle').innerText = q ? 'ویرایش پرسشنامه' : 'ساخت پرسشنامه جدید';
    document.getElementById('qName').value = q ? q.name : '';
    tempSections = q && q.sections ? JSON.parse(JSON.stringify(q.sections)) : [];
    undoStack = [];
    renderBuilderSections();
    updateCounter();
    checkBuilderDraft();
    showPage('builderPage');
}

function updateCounter() {
    const sectionCount = tempSections.length;
    let questionCount = 0;
    tempSections.forEach(s => { questionCount += (s.questions || []).length; });
    document.getElementById('sectionCount').innerText = sectionCount;
    document.getElementById('questionCount').innerText = questionCount;
}

function showAutoSaveIndicator(status) {
    const indicator = document.getElementById('autoSaveIndicator');
    const text = document.getElementById('autoSaveText');
    if (status === 'saving') {
        indicator.className = 'autosave-indicator show saving';
        text.textContent = 'در حال ذخیره...';
    } else if (status === 'saved') {
        indicator.className = 'autosave-indicator show saved';
        text.textContent = 'ذخیره شد';
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }
}

function autoSaveBuilderDraft() {
    if (builderAutoSaveTimer) clearTimeout(builderAutoSaveTimer);
    builderAutoSaveTimer = setTimeout(() => {
        showAutoSaveIndicator('saving');
        const draft = {
            name: document.getElementById('qName').value,
            sections: tempSections,
            editId: currentEditId
        };
        localStorage.setItem(BUILDER_DRAFT_PREFIX + 'current', JSON.stringify(draft));
        setTimeout(() => showAutoSaveIndicator('saved'), 500);
    }, 2000);
}

function checkBuilderDraft() {
    const draft = localStorage.getItem(BUILDER_DRAFT_PREFIX + 'current');
    if (draft && !currentEditId) {
        try {
            const data = JSON.parse(draft);
            if (data.sections && data.sections.length > 0 && data.name) {
                showConfirmModal('پیش‌نویس ویرایش قبلی یافت شد. بازیابی شود؟', () => {
                    document.getElementById('qName').value = data.name || '';
                    tempSections = data.sections;
                    renderBuilderSections();
                    updateCounter();
                    showToast('پیش‌نویس بازیابی شد');
                }, () => {
                    localStorage.removeItem(BUILDER_DRAFT_PREFIX + 'current');
                });
            }
        } catch (e) {}
    }
}

function renderBuilderSections() {
    const container = document.getElementById('sectionsContainer');
    if (!tempSections.length) {
        container.innerHTML = `<div class="card glass text-center" style="padding:30px;opacity:0.7;">
            <div style="font-size:2.5rem;margin-bottom:8px;"><img src="images/form.png" alt="" style="width:40px;height:40px;"></div>
            <p>هنوز بخشی اضافه نشده. دکمه "افزودن بخش جدید" را بزنید.</p>
        </div>`;
        return;
    }

    container.innerHTML = '';
    tempSections.forEach((section, secIdx) => {
        const secDiv = document.createElement('div');
        secDiv.className = 'section-collapse glass';
        secDiv.innerHTML = `
            <div class="section-header" data-sec="${secIdx}">
                <span class="drag-handle" data-sec="${secIdx}" title="برای جابجایی بکشید">${icon('drag')}</span>
                <input type="text" class="section-title-input" value="${escapeHtml(section.title)}" data-sec="${secIdx}">
                <span class="toggle-icon">▼</span>
                <div class="flex-between" style="gap:6px;">
                    <div class="tooltip-container">
                        <button class="btn btn-sm move-section-up" data-sec="${secIdx}" ${secIdx === 0 ? 'disabled' : ''}><img src="images/up.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                        <span class="tooltip-text">انتقال به بالا</span>
                    </div>
                    <div class="tooltip-container">
                        <button class="btn btn-sm move-section-down" data-sec="${secIdx}" ${secIdx === tempSections.length - 1 ? 'disabled' : ''}><img src="images/down.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                        <span class="tooltip-text">انتقال به پایین</span>
                    </div>
                    <div class="tooltip-container">
                        <button class="btn copy-section-btn" data-sec="${secIdx}"><img src="images/copy.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                        <span class="tooltip-text">کپی کل بخش</span>
                    </div>
                    <div class="tooltip-container">
                        <button class="btn btn-sm remove-section" data-sec="${secIdx}"><img src="images/delete.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                        <span class="tooltip-text">حذف بخش</span>
                    </div>
                </div>
            </div>
            <div class="section-content" id="section-content-${secIdx}">
                <div id="questions-container-${secIdx}" class="mb-3"></div>
                <div class="flex-between">
                    <div class="tooltip-container">
                        <button class="btn btn-primary btn-sm add-question glass-btn" data-sec="${secIdx}"><img src="images/add.png" alt="" class="icon-img"></button>
                        <span class="tooltip-text">افزودن سوال</span>
                    </div>
                    <div class="tooltip-container">
                        <button class="btn btn-warning btn-sm delete-all-questions glass-btn" data-sec="${secIdx}"><img src="images/delete.png" alt="" class="icon-img"></button>
                        <span class="tooltip-text">حذف همه سوالات</span>
                    </div>
                </div>
            </div>`;
        container.appendChild(secDiv);

        const contentDiv = secDiv.querySelector('.section-content');
        const toggleIcon = secDiv.querySelector('.toggle-icon');
        const header = secDiv.querySelector('.section-header');

        let collapsed = false;
        header.addEventListener('click', (e) => {
            if (['remove-section', 'section-title-input', 'move-section-up', 'move-section-down', 'copy-section-btn', 'drag-handle'].some(c => e.target.classList.contains(c) || e.target.closest(`.${c}`))) return;
            collapsed = !collapsed;
            contentDiv.classList.toggle('collapsed', collapsed);
            toggleIcon.innerHTML = collapsed ? '▶' : '▼';
        });

        secDiv.querySelector('.section-title-input').addEventListener('change', (e) => {
            pushUndo();
            tempSections[secIdx].title = e.target.value;
            autoSaveBuilderDraft();
        });

        secDiv.querySelector('.move-section-up')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (secIdx > 0) {
                pushUndo();
                [tempSections[secIdx - 1], tempSections[secIdx]] = [tempSections[secIdx], tempSections[secIdx - 1]];
                renderBuilderSections();
                updateCounter();
                autoSaveBuilderDraft();
            }
        });

        secDiv.querySelector('.move-section-down')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (secIdx < tempSections.length - 1) {
                pushUndo();
                [tempSections[secIdx + 1], tempSections[secIdx]] = [tempSections[secIdx], tempSections[secIdx + 1]];
                renderBuilderSections();
                updateCounter();
                autoSaveBuilderDraft();
            }
        });

        // کپی بخش
        secDiv.querySelector('.copy-section-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            pushUndo();
            const copy = JSON.parse(JSON.stringify(section));
            copy.title = copy.title + ' (کپی)';
            copy.questions = copy.questions.map(q => ({ ...q, id: Date.now() + Math.random() }));
            tempSections.splice(secIdx + 1, 0, copy);
            renderBuilderSections();
            updateCounter();
            autoSaveBuilderDraft();
            showToast('بخش کپی شد');
        });

        const qContainer = secDiv.querySelector(`#questions-container-${secIdx}`);
        if (section.questions && section.questions.length) {
            section.questions.forEach((q, qIdx) => {
                const qCard = document.createElement('div');
                qCard.className = 'question-card glass' + (q.locked ? ' locked' : '');
                qCard.draggable = true;
                qCard.dataset.secIdx = secIdx;
                qCard.dataset.qIdx = qIdx;
                qCard.innerHTML = `
                    <div class="question-header">
                        <span class="drag-handle" data-sec="${secIdx}" data-qidx="${qIdx}" title="برای جابجایی بکشید">${icon('drag')}</span>
                        <span class="question-label">
                            <span style="color:var(--btn-primary);">${secIdx + 1}.${qIdx + 1} - </span>
                            ${escapeHtml(q.label)} ${q.required ? '<span class="required-star">*</span>' : ''}
                            ${q.locked ? icon('lock') : ''}
                        </span>
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            <div class="tooltip-container">
                                <button class="btn btn-sm move-q-up" data-sec="${secIdx}" data-qidx="${qIdx}" ${qIdx === 0 ? 'disabled' : ''}><img src="images/up.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">انتقال به بالا</span>
                            </div>
                            <div class="tooltip-container">
                                <button class="btn btn-sm move-q-down" data-sec="${secIdx}" data-qidx="${qIdx}" ${qIdx === section.questions.length - 1 ? 'disabled' : ''}><img src="images/down.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">انتقال به پایین</span>
                            </div>
                            <div class="tooltip-container">
                                <button class="btn btn-sm duplicate-question" data-sec="${secIdx}" data-qidx="${qIdx}"><img src="images/copy.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">کپی سوال</span>
                            </div>
                            <div class="tooltip-container">
                                <button class="btn lock-btn ${q.locked ? 'locked' : ''}" data-sec="${secIdx}" data-qidx="${qIdx}"><img src="${q.locked ? 'images/lock.png' : 'images/unlock.png'}" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">${q.locked ? 'باز کردن قفل' : 'قفل کردن'}</span>
                            </div>
                            <div class="tooltip-container">
                                <button class="btn btn-sm edit-question" data-sec="${secIdx}" data-qidx="${qIdx}"><img src="images/edit.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">ویرایش سوال</span>
                            </div>
                            <div class="tooltip-container">
                                <button class="btn btn-sm delete-question" data-sec="${secIdx}" data-qidx="${qIdx}"><img src="images/delete.png" alt="" class="icon-img" style="width:24px;height:24px;"></button>
                                <span class="tooltip-text">حذف سوال</span>
                            </div>
                        </div>
                    </div>
                    <div style="color:var(--text-secondary);font-size:0.85rem;">نوع: ${getTypeName(q.type)}${q.condition ? ' | دارای شرط' : ''}</div>`;
                qContainer.appendChild(qCard);
            });
        } else {
            qContainer.innerHTML = '<div class="text-center" style="opacity:0.6;padding:12px;">هیچ سوالی در این بخش وجود ندارد.</div>';
        }
    });

    // اتصال رویدادها
    document.querySelectorAll('.remove-section').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.sec);
        showConfirmModal('آیا این بخش با تمام سوالاتش حذف شود؟', () => {
            pushUndo();
            tempSections.splice(sec, 1);
            renderBuilderSections();
            updateCounter();
            autoSaveBuilderDraft();
        });
    }));

    document.querySelectorAll('.add-question').forEach(btn => btn.addEventListener('click', () => {
        openQuestionModal(parseInt(btn.dataset.sec), null);
    }));

    document.querySelectorAll('.edit-question').forEach(btn => btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        if (tempSections[sec].questions[qidx].locked) {
            showToast('سوال قفل شده ابتدا باید باز شود', true);
            return;
        }
        openQuestionModal(sec, qidx);
    }));

    document.querySelectorAll('.delete-question').forEach(btn => btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        if (tempSections[sec].questions[qidx].locked) {
            showToast('سوال قفل شده ابتدا باید باز شود', true);
            return;
        }
        showConfirmModal('آیا این سوال حذف شود؟', () => {
            pushUndo();
            tempSections[sec].questions.splice(qidx, 1);
            renderBuilderSections();
            updateCounter();
            autoSaveBuilderDraft();
        });
    }));

    document.querySelectorAll('.delete-all-questions').forEach(btn => btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.sec);
        showConfirmModal(`همه سوالات بخش "${tempSections[sec].title}" حذف شوند؟`, () => {
            pushUndo();
            tempSections[sec].questions = [];
            renderBuilderSections();
            updateCounter();
            autoSaveBuilderDraft();
        });
    }));

    document.querySelectorAll('.move-q-up').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        if (qidx > 0) {
            pushUndo();
            [tempSections[sec].questions[qidx - 1], tempSections[sec].questions[qidx]] =
                [tempSections[sec].questions[qidx], tempSections[sec].questions[qidx - 1]];
            renderBuilderSections();
            autoSaveBuilderDraft();
        }
    }));

    document.querySelectorAll('.move-q-down').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        if (qidx < tempSections[sec].questions.length - 1) {
            pushUndo();
            [tempSections[sec].questions[qidx + 1], tempSections[sec].questions[qidx]] =
                [tempSections[sec].questions[qidx], tempSections[sec].questions[qidx + 1]];
            renderBuilderSections();
            autoSaveBuilderDraft();
        }
    }));

    document.querySelectorAll('.duplicate-question').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        pushUndo();
        const original = tempSections[sec].questions[qidx];
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = Date.now() + Math.random();
        copy.locked = false;
        tempSections[sec].questions.push(copy);
        renderBuilderSections();
        updateCounter();
        autoSaveBuilderDraft();
        showToast('سوال کپی شد');
    }));

    // قفل سوال
    document.querySelectorAll('.lock-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.sec), qidx = parseInt(btn.dataset.qidx);
        tempSections[sec].questions[qidx].locked = !tempSections[sec].questions[qidx].locked;
        renderBuilderSections();
        autoSaveBuilderDraft();
    }));

    // Drag & Drop
    initDragAndDrop();
}

// ========================================
//   Drag & Drop
// ========================================

function initDragAndDrop() {
    const cards = document.querySelectorAll('.question-card');
    let draggedCard = null;
    let draggedSec = null;
    let draggedQidx = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            draggedSec = parseInt(card.dataset.secIdx);
            draggedQidx = parseInt(card.dataset.qIdx);
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            cards.forEach(c => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (!draggedCard || draggedCard === card) return;

            const targetSec = parseInt(card.dataset.secIdx);
            const targetQidx = parseInt(card.dataset.qIdx);

            if (draggedSec === targetSec) {
                pushUndo();
                const questions = tempSections[draggedSec].questions;
                const [moved] = questions.splice(draggedQidx, 1);
                questions.splice(targetQidx, 0, moved);
                renderBuilderSections();
                autoSaveBuilderDraft();
            }
        });
    });
}

// ========================================
//   پیش‌نمایش پرسشنامه
// ========================================

function showPreview() {
    const name = document.getElementById('qName').value.trim() || 'پرسشنامه بدون نام';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let html = '';
    tempSections.forEach((section, secIdx) => {
        html += `<div class="preview-section">
            <div class="preview-section-title">${secIdx + 1}. ${escapeHtml(section.title)}</div>`;
        (section.questions || []).forEach((q, qIdx) => {
            html += `<div class="preview-question">
                <div class="preview-question-label">${secIdx + 1}.${qIdx + 1}. ${escapeHtml(q.label)} ${q.required ? '<span class="required-star">*</span>' : ''}</div>`;
            if (q.options && ['radio', 'select', 'likert'].includes(q.type)) {
                html += '<div class="preview-options">';
                q.options.forEach(opt => {
                    html += `<div class="preview-option">${escapeHtml(opt.text)} (کد: ${opt.code})</div>`;
                });
                html += '</div>';
            } else if (q.options && q.type === 'checkbox') {
                html += '<div class="preview-options">';
                q.options.forEach(opt => {
                    html += `<div class="preview-option checkbox">${escapeHtml(opt.text)} (کد: ${opt.code})</div>`;
                });
                html += '</div>';
            } else if (q.type === 'number') {
                html += `<div class="preview-options"><div class="preview-option">عدد${q.min !== undefined ? ` (حداقل: ${q.min})` : ''}${q.max !== undefined ? ` (حداکثر: ${q.max})` : ''}</div></div>`;
            } else if (q.type === 'text') {
                html += '<div class="preview-options"><div class="preview-option">_______________________________</div></div>';
            } else if (q.type === 'textarea') {
                html += '<div class="preview-options"><div class="preview-option">_______________________________</div><div class="preview-option">_______________________________</div><div class="preview-option">_______________________________</div></div>';
            } else if (q.type === 'date') {
                html += '<div class="preview-options"><div class="preview-option">____ / ____ / ____</div></div>';
            }
            html += '</div>';
        });
        html += '</div>';
    });

    overlay.innerHTML = `
        <div class="modal-content" style="max-width:700px;">
            <button class="modal-close-btn" id="closePreviewModal">${icon('close')}</button>
            <h2>پیش‌نمایش پرسشنامه</h2>
            <h3 style="color:var(--btn-primary);margin:12px 0;">${escapeHtml(name)}</h3>
            <hr class="glass-hr">
            ${html || '<p style="text-align:center;opacity:0.7;">هنوز سوالی اضافه نشده.</p>'}
            <div class="flex-between mt-3">
                <button id="printPreviewBtn" class="btn btn-secondary glass-btn">${icon('print')} چاپ</button>
                <button id="closePreviewBtn" class="btn btn-primary glass-btn">بستن</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    document.getElementById('closePreviewModal').onclick = closeModal;
    document.getElementById('closePreviewBtn').onclick = closeModal;
    document.getElementById('printPreviewBtn').onclick = () => window.print();
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

// ========================================
//   مودال سوال
// ========================================

function openQuestionModal(sectionIdx, questionIdx) {
    const question = (questionIdx !== null) ? tempSections[sectionIdx].questions[questionIdx] : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'questionModalOverlay';

    overlay.innerHTML = `
        <div class="modal-content">
            <button class="modal-close-btn" id="closeModalTop">${icon('close')}</button>
            <h3>${question ? 'ویرایش سوال' : 'سوال جدید'}</h3>
            <label>متن سوال <span style="color:red">*</span></label>
            <input type="text" id="modalLabel" value="${question ? escapeHtml(question.label) : ''}" class="glass-input">
            <label>نوع سوال</label>
            <select id="modalType" class="glass-input">
                ${['text', 'textarea', 'number', 'radio', 'checkbox', 'select', 'likert', 'date'].map(t =>
                    `<option value="${t}" ${question && question.type === t ? 'selected' : ''}>${getTypeName(t)}</option>`).join('')}
            </select>
            <div id="modalOptionsContainer" style="margin-top:15px;"></div>
            <div id="modalNumberConfig" style="margin-top:15px; display:none;">
                <div><label>حداقل مقدار</label><input type="number" id="minVal" value="${question && question.min !== undefined ? question.min : ''}" class="glass-input"></div>
                <div class="mt-2"><label>حداکثر مقدار</label><input type="number" id="maxVal" value="${question && question.max !== undefined ? question.max : ''}" class="glass-input"></div>
                <div class="mt-2"><label>اعشار مجاز</label><input type="number" id="stepVal" step="any" value="${question && question.step !== undefined ? question.step : '1'}" class="glass-input"></div>
            </div>
            <div id="modalConditionContainer" class="mt-3">
                <label class="check-label"><input type="checkbox" id="enableCondition" ${question && question.condition ? 'checked' : ''}> شرط نمایش</label>
                <div id="conditionDetails" style="display:${question && question.condition ? 'block' : 'none'}; margin-top:10px; padding-right:20px;">
                    <label>سوال مبدأ</label>
                    <select id="conditionSourceId" class="glass-input"></select>
                    <label>عملگر</label>
                    <select id="conditionOperator" class="glass-input">
                        <option value="equals">برابر باشد با</option>
                        <option value="notEquals">برابر نباشد با</option>
                        <option value="contains">شامل</option>
                    </select>
                    <label>مقدار (کد عددی گزینه)</label>
                    <input type="text" id="conditionValue" placeholder="مثلاً 1" value="${question && question.condition ? (question.condition.value || '') : ''}" class="glass-input">
                    <div id="sourceOptionsHint" style="font-size:0.8rem; color:var(--btn-primary); margin-top:5px;"></div>
                </div>
            </div>
            <label class="check-label mt-2"><input type="checkbox" id="modalRequired" ${question && question.required ? 'checked' : ''}> اجباری</label>
            <div class="flex-between mt-3">
                <button id="closeModalBtn" class="btn btn-secondary">انصراف</button>
                <button id="saveModalBtn" class="btn btn-primary">ذخیره</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const typeSelect = document.getElementById('modalType');
    const optionsContainer = document.getElementById('modalOptionsContainer');
    const numberConfigDiv = document.getElementById('modalNumberConfig');
    const conditionCheckbox = document.getElementById('enableCondition');
    const conditionDetails = document.getElementById('conditionDetails');
    const conditionSourceSelect = document.getElementById('conditionSourceId');
    const sourceOptionsHint = document.getElementById('sourceOptionsHint');

    function populateSourceQuestions() {
        let allQuestions = [];
        for (let i = 0; i <= sectionIdx; i++) {
            (tempSections[i].questions || []).forEach((q, idx) => {
                if (i === sectionIdx && idx === questionIdx) return;
                allQuestions.push({ id: q.id, label: q.label, options: q.options, type: q.type, section: i });
            });
        }
        conditionSourceSelect.innerHTML = '<option value="">انتخاب کنید</option>';
        allQuestions.forEach(q => {
            conditionSourceSelect.innerHTML += `<option value="${q.id}" ${question && question.condition && question.condition.sourceId == q.id ? 'selected' : ''}>${escapeHtml(q.label)} (بخش ${q.section + 1})</option>`;
        });
        conditionSourceSelect.addEventListener('change', () => {
            const selectedId = conditionSourceSelect.value;
            const srcQ = allQuestions.find(q => q.id == selectedId);
            if (srcQ && (srcQ.type === 'radio' || srcQ.type === 'select' || srcQ.type === 'likert')) {
                let opts = srcQ.options || [];
                sourceOptionsHint.innerHTML = '<strong>گزینه‌های موجود:</strong> ' + opts.map(o => `${o.text} (کد ${o.code})`).join(' ، ');
            } else {
                sourceOptionsHint.innerHTML = '<strong>توجه:</strong> سوال مبدأ باید از نوع چند گزینه‌ای، لیکرت یا لیست کشویی باشد.';
            }
        });
        if (conditionSourceSelect.value) conditionSourceSelect.dispatchEvent(new Event('change'));
    }
    populateSourceQuestions();

    function updateOptionsUI() {
        const type = typeSelect.value;
        if (['radio', 'checkbox', 'select'].includes(type)) {
            optionsContainer.innerHTML = `<label>تعداد گزینه‌ها</label><input type="number" id="optionCount" min="1" value="${question && question.options ? question.options.length : 2}" class="glass-input"><div id="optionsList"></div>`;
            const countInput = document.getElementById('optionCount');
            const optionsListDiv = document.getElementById('optionsList');
            function renderOptions() {
                let count = parseInt(countInput.value) || 0;
                const currentOpts = (question && question.options) ? question.options : [];
                let html = '';
                for (let i = 0; i < count; i++) {
                    const optText = (currentOpts[i] && currentOpts[i].text) ? currentOpts[i].text : '';
                    const optCode = (currentOpts[i] && currentOpts[i].code) ? currentOpts[i].code : (i + 1);
                    html += `<div class="option-item mb-2" style="display:flex;gap:8px;align-items:center;">
                        <input type="text" placeholder="متن گزینه" value="${escapeHtml(optText)}" class="opt-text glass-input" data-idx="${i}" style="flex:3;margin:0;">
                        <input type="number" placeholder="کد" value="${optCode}" class="opt-code glass-input" data-idx="${i}" style="width:80px;margin:0;">
                        <button class="btn btn-danger btn-sm remove-opt" data-idx="${i}" style="flex-shrink:0;">${icon('remove')}</button>
                    </div>`;
                }
                html += `<button id="addOptionBtn" class="btn btn-sm btn-primary glass-btn">${icon('add')} افزودن گزینه</button>`;
                optionsListDiv.innerHTML = html;
                document.querySelectorAll('.remove-opt').forEach(btn => btn.addEventListener('click', () => {
                    let newCount = (parseInt(countInput.value) || 1) - 1;
                    if (newCount < 1) newCount = 1;
                    countInput.value = newCount;
                    renderOptions();
                }));
                document.getElementById('addOptionBtn')?.addEventListener('click', () => {
                    countInput.value = parseInt(countInput.value) + 1;
                    renderOptions();
                });
            }
            countInput.addEventListener('input', renderOptions);
            renderOptions();
            optionsContainer.style.display = 'block';
            numberConfigDiv.style.display = 'none';
        } else if (type === 'likert') {
            optionsContainer.innerHTML = `<label>گزینه‌های لیکرت</label><div id="likertOptions"></div>`;
            const defaultLikert = ['کاملاً مخالفم', 'مخالفم', 'نظری ندارم', 'موافقم', 'کاملاً موافقم'];
            const currentLikert = (question && question.options && question.options.length) ? question.options.map(o => o.text) : defaultLikert;
            const likertDiv = document.getElementById('likertOptions');
            let likertHtml = '';
            currentLikert.forEach((opt, idx) => {
                likertHtml += `<input type="text" value="${escapeHtml(opt)}" class="likert-opt glass-input" data-idx="${idx}" style="margin-bottom:6px;">`;
            });
            likertDiv.innerHTML = likertHtml;
            optionsContainer.style.display = 'block';
            numberConfigDiv.style.display = 'none';
        } else if (type === 'number') {
            optionsContainer.style.display = 'none';
            numberConfigDiv.style.display = 'block';
        } else {
            optionsContainer.style.display = 'none';
            numberConfigDiv.style.display = 'none';
        }
    }

    typeSelect.addEventListener('change', updateOptionsUI);
    updateOptionsUI();

    conditionCheckbox.addEventListener('change', () => {
        conditionDetails.style.display = conditionCheckbox.checked ? 'block' : 'none';
    });

    const closeModal = () => overlay.remove();
    document.getElementById('closeModalTop').onclick = closeModal;
    document.getElementById('closeModalBtn').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    document.getElementById('saveModalBtn').onclick = () => {
        const label = document.getElementById('modalLabel').value.trim();
        if (!label) { showToast('متن سوال الزامی است', true); return; }
        const type = typeSelect.value;
        let options = [];
        if (['radio', 'checkbox', 'select'].includes(type)) {
            const optTexts = Array.from(document.querySelectorAll('.opt-text')).map(inp => inp.value.trim()).filter(v => v);
            const optCodes = Array.from(document.querySelectorAll('.opt-code')).map(inp => parseInt(inp.value) || 0);
            options = optTexts.map((text, idx) => ({ text, code: optCodes[idx] || (idx + 1) }));
            if (options.length === 0) { showToast('حداقل یک گزینه وارد کنید', true); return; }
        } else if (type === 'likert') {
            const likertTexts = Array.from(document.querySelectorAll('.likert-opt')).map(inp => inp.value.trim());
            if (likertTexts.length < 2) { showToast('لیکرت باید حداقل ۲ گزینه داشته باشد', true); return; }
            options = likertTexts.map((text, idx) => ({ text, code: idx + 1 }));
        }
        let condition = null;
        if (conditionCheckbox.checked) {
            const sourceId = conditionSourceSelect.value;
            if (!sourceId) { showToast('سوال مبدأ را انتخاب کنید', true); return; }
            const operator = document.getElementById('conditionOperator').value;
            const value = document.getElementById('conditionValue').value.trim();
            if (!value) { showToast('مقدار شرط را وارد کنید', true); return; }
            condition = { sourceId: sourceId.toString(), operator, value };
        }
        let min, max, step;
        if (type === 'number') {
            min = document.getElementById('minVal').value ? parseFloat(document.getElementById('minVal').value) : undefined;
            max = document.getElementById('maxVal').value ? parseFloat(document.getElementById('maxVal').value) : undefined;
            step = document.getElementById('stepVal').value ? parseFloat(document.getElementById('stepVal').value) : 1;
        }
        pushUndo();
        const newQuestion = {
            id: question ? question.id : Date.now() + Math.random(),
            label, type, options: options.length ? options : undefined,
            required: document.getElementById('modalRequired').checked,
            condition, min, max, step, locked: question ? question.locked : false
        };
        if (questionIdx !== null) tempSections[sectionIdx].questions[questionIdx] = newQuestion;
        else {
            if (!tempSections[sectionIdx].questions) tempSections[sectionIdx].questions = [];
            tempSections[sectionIdx].questions.push(newQuestion);
        }
        renderBuilderSections();
        updateCounter();
        closeModal();
        autoSaveBuilderDraft();
        showToast('سوال ذخیره شد');
    };
}

function saveQuestionnaire() {
    const name = document.getElementById('qName').value.trim();
    if (!name) { showToast('لطفاً نام پرسشنامه را وارد کنید', true); return; }
    for (let i = 0; i < tempSections.length; i++) {
        if (!tempSections[i].title) { showToast(`بخش ${i + 1} عنوان ندارد`, true); return; }
    }
    if (currentEditId) {
        const idx = questionnaires.findIndex(q => q.id === currentEditId);
        if (idx !== -1) { questionnaires[idx].name = name; questionnaires[idx].sections = tempSections; }
    } else {
        const newId = Date.now();
        questionnaires.push({ id: newId, name, sections: tempSections });
    }
    saveAll();
    localStorage.removeItem(BUILDER_DRAFT_PREFIX + 'current');
    showToast('پرسشنامه ذخیره شد');
    backToDashboard();
}

// ========================================
//   پاسخگویی
// ========================================

function openRespond(id) {
    currentRespondId = id;
    const q = questionnaires.find(q => q.id === id);
    if (!q) return;
    renderRespondForm(q);
    checkDraft(q);
    showPage('respondPage');
}

function checkDraft(q) {
    const draftKey = DRAFT_PREFIX + q.id;
    const draft = localStorage.getItem(draftKey);
    const notice = document.getElementById('draftNotice');
    if (draft) {
        notice.innerHTML = `<span>پیش‌نویس ذخیره شده‌ای برای این پرسشنامه وجود دارد. 
            <button id="restoreDraftBtn" class="btn btn-sm btn-primary glass-btn">بازیابی</button> 
            <button id="discardDraftBtn" class="btn btn-sm btn-secondary glass-btn">نادیده گرفتن</button></span>`;
        notice.classList.remove('hidden');
        document.getElementById('restoreDraftBtn').onclick = () => {
            localStorage.removeItem(draftKey);
            notice.classList.add('hidden');
            const answers = JSON.parse(draft);
            for (let qId in answers) {
                const val = answers[qId];
                const input = document.querySelector(`[data-id="${qId}"]`);
                if (input) {
                    if (input.type === 'radio') {
                        const radio = document.querySelector(`input[name="radio_${qId}"][value="${val}"]`);
                        if (radio) radio.checked = true;
                    } else input.value = val;
                }
            }
            applyConditions(q);
            showToast('پیش‌نویس بازیابی شد');
        };
        document.getElementById('discardDraftBtn').onclick = () => {
            localStorage.removeItem(draftKey);
            notice.classList.add('hidden');
            showToast('پیش‌نویس حذف شد');
        };
    } else {
        notice.classList.add('hidden');
    }
}

function autoSaveDraft(q) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        const answers = {};
        q.sections.forEach(section => {
            (section.questions || []).forEach(question => {
                const qId = question.id, type = question.type;
                let val = null;
                if (type === 'radio' || type === 'likert') {
                    const checked = document.querySelector(`input[name="radio_${qId}"]:checked, input[name="likert_${qId}"]:checked`);
                    val = checked ? checked.value : null;
                } else if (type === 'checkbox') {
                    const checked = Array.from(document.querySelectorAll(`.response-checkbox[data-id="${qId}"]:checked`)).map(cb => cb.value);
                    val = checked.length ? checked : null;
                } else {
                    const input = document.querySelector(`.response-field[data-id="${qId}"]`);
                    val = input ? input.value : null;
                }
                answers[qId] = val;
            });
        });
        localStorage.setItem(DRAFT_PREFIX + q.id, JSON.stringify(answers));
    }, 800);
}

function renderRespondForm(q) {
    let html = `<h3>${escapeHtml(q.name)}</h3>`;
    q.sections.forEach((section, secIdx) => {
        html += `<div class="section-collapse glass"><div class="section-header" data-sec="${secIdx}">
            <span>${secIdx + 1} - ${escapeHtml(section.title)}</span><span class="toggle-icon">▼</span></div>
            <div class="section-content" id="resp-section-${secIdx}">`;
        (section.questions || []).forEach((question, qIdx) => {
            const qId = question.id;
            const isFirst = (secIdx === 0 && qIdx === 0);
            html += `<div id="q-${qId}" class="question-card glass" data-question-id="${qId}">
                <div class="question-label"><span style="color:var(--btn-primary);">${secIdx + 1}.${qIdx + 1} - </span>${escapeHtml(question.label)} ${question.required ? '<span class="required-star">*</span>' : ''}</div>
                ${isFirst ? '<div class="unique-warning" style="display:block;">مقدار این سوال باید یکتا باشد</div>' : '<div class="unique-warning"></div>'}`;
            if (question.type === 'text') html += `<input type="text" class="response-field glass-input" data-id="${qId}" data-required="${question.required}">`;
            else if (question.type === 'textarea') html += `<textarea class="response-field glass-input" data-id="${qId}" data-required="${question.required}" rows="3"></textarea>`;
            else if (question.type === 'number') {
                const step = question.step || 1;
                const min = question.min !== undefined ? `min="${question.min}"` : '';
                const max = question.max !== undefined ? `max="${question.max}"` : '';
                html += `<input type="number" ${min} ${max} step="${step}" class="response-field glass-input" data-id="${qId}" data-required="${question.required}">`;
            } else if (question.type === 'radio') {
                html += '<div class="options-group-vertical">';
                question.options.forEach(opt => {
                    html += `<label class="option-item"><input type="radio" name="radio_${qId}" value="${opt.code}" class="response-radio" data-id="${qId}" data-required="${question.required}"> ${escapeHtml(opt.text)}</label>`;
                });
                html += '</div>';
            } else if (question.type === 'checkbox') {
                html += '<div class="options-group-vertical">';
                question.options.forEach(opt => {
                    html += `<label class="option-item"><input type="checkbox" value="${opt.code}" class="response-checkbox" data-id="${qId}"> ${escapeHtml(opt.text)}</label>`;
                });
                html += '</div>';
            } else if (question.type === 'select') {
                html += `<select class="response-field glass-input" data-id="${qId}" data-required="${question.required}"><option value="">انتخاب کنید</option>`;
                question.options.forEach(opt => { html += `<option value="${opt.code}">${escapeHtml(opt.text)}</option>`; });
                html += '</select>';
            } else if (question.type === 'likert') {
                html += '<div class="options-group-vertical">';
                question.options.forEach(opt => {
                    html += `<label class="option-item"><input type="radio" name="likert_${qId}" value="${opt.code}" class="response-radio" data-id="${qId}" data-required="${question.required}"> ${escapeHtml(opt.text)}</label>`;
                });
                html += '</div>';
            } else if (question.type === 'date') {
                html += `<input type="text" placeholder="سال/ماه/روز" class="response-field glass-input" data-id="${qId}" data-required="${question.required}">`;
            }
            html += '</div>';
        });
        html += '</div></div>';
    });
    document.getElementById('respondForm').innerHTML = html;

    document.querySelectorAll('#respondForm .section-header').forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            const icon = this.querySelector('.toggle-icon');
            if (content) { content.classList.toggle('collapsed'); icon.innerHTML = content.classList.contains('collapsed') ? '▶' : '▼'; }
        });
    });

    applyConditions(q);
    attachAutoSave(q);
}

function attachAutoSave(q) {
    const form = document.getElementById('respondForm');
    form.addEventListener('change', (e) => {
        autoSaveDraft(q);
        applyConditions(q);
    });
    form.addEventListener('input', (e) => {
        autoSaveDraft(q);
        applyConditions(q);
    });
}

// ========================================
//   شرط نمایش (اصلاح شده)
// ========================================

function applyConditions(q) {
    let answers = {};
    q.sections.forEach(section => {
        (section.questions || []).forEach(question => {
            const qId = question.id, type = question.type;
            let val = null;
            if (type === 'radio' || type === 'likert') {
                const selector = type === 'likert' 
                    ? `input[name="likert_${qId}"]:checked` 
                    : `input[name="radio_${qId}"]:checked`;
                const checked = document.querySelector(selector);
                val = checked ? checked.value : null;
            } else if (type === 'checkbox') {
                const checked = Array.from(document.querySelectorAll(`.response-checkbox[data-id="${qId}"]:checked`)).map(cb => cb.value);
                val = checked.length ? checked : null;
            } else {
                const input = document.querySelector(`.response-field[data-id="${qId}"]`);
                val = input ? input.value : null;
            }
            answers[qId] = val;
        });
    });

    q.sections.forEach(section => {
        (section.questions || []).forEach(question => {
            const qDiv = document.getElementById(`q-${question.id}`);
            if (!qDiv) return;
            if (question.condition) {
                const cond = question.condition;
                const sourceVal = answers[cond.sourceId];
                let show = false;
                if (cond.operator === 'equals') {
                    show = (sourceVal !== null && sourceVal !== undefined && sourceVal.toString() === cond.value);
                } else if (cond.operator === 'notEquals') {
                    show = (sourceVal !== null && sourceVal !== undefined && sourceVal.toString() !== cond.value);
                } else if (cond.operator === 'contains') {
                    show = (sourceVal !== null && sourceVal !== undefined && sourceVal.toString().includes(cond.value));
                }
                qDiv.style.display = show ? 'block' : 'none';
            } else {
                qDiv.style.display = 'block';
            }
        });
    });
}

function isFirstQuestionUnique(value, q) {
    const firstQ = q.sections[0]?.questions[0];
    if (!firstQ) return true;
    const existingResponses = responses[q.id] || [];
    return !existingResponses.some(resp => resp[firstQ.id] != undefined && resp[firstQ.id].toString() === value.toString());
}

function collectAnswers(q, isEditing = false, excludeFirstCheck = false) {
    let answer = {}, valid = true;
    for (let section of q.sections) {
        for (let question of (section.questions || [])) {
            const qId = question.id, qDiv = document.getElementById(`q-${qId}`);
            if (qDiv && qDiv.style.display === 'none') continue;
            let val = null;
            if (question.type === 'radio' || question.type === 'likert') {
                const checked = document.querySelector(`input[name="radio_${qId}"]:checked, input[name="likert_${qId}"]:checked`);
                val = checked ? checked.value : null;
            } else if (question.type === 'checkbox') {
                const checked = Array.from(document.querySelectorAll(`.response-checkbox[data-id="${qId}"]:checked`)).map(cb => cb.value);
                val = checked.length ? checked : null;
            } else {
                const input = document.querySelector(`.response-field[data-id="${qId}"]`);
                val = input ? input.value : null;
            }
            if (question.required && (val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
                valid = false;
                showToast(`لطفاً به سوال "${question.label}" پاسخ دهید`, true);
                return { valid: false, answer: null };
            }
            answer[qId] = val;
        }
    }
    if (!isEditing && !excludeFirstCheck) {
        const firstQ = q.sections[0]?.questions[0];
        if (firstQ && answer[firstQ.id] !== undefined && !isFirstQuestionUnique(answer[firstQ.id], q)) {
            valid = false;
            showToast(`مقدار "${firstQ.label}" باید یکتا باشد و قبلاً ثبت شده است`, true);
            return { valid: false, answer: null };
        }
    }
    return { valid, answer };
}

function submitResponse(returnToDashboard = false) {
    const q = questionnaires.find(q => q.id === currentRespondId);
    if (!q) return;
    const { valid, answer } = collectAnswers(q);
    if (!valid) return;
    if (!responses[currentRespondId]) responses[currentRespondId] = [];
    responses[currentRespondId].push(answer);
    saveAll();
    localStorage.removeItem(DRAFT_PREFIX + q.id);
    document.getElementById('draftNotice').classList.add('hidden');
    showToast('پاسخ با موفقیت ثبت شد');
    if (returnToDashboard) backToDashboard();
    else renderRespondForm(q);
}

function clearResponseForm() {
    const q = questionnaires.find(q => q.id === currentRespondId);
    if (q) {
        renderRespondForm(q);
        localStorage.removeItem(DRAFT_PREFIX + q.id);
        document.getElementById('draftNotice').classList.add('hidden');
        showToast('فرم پاک شد');
    }
}

// ========================================
//   صفحه داده‌ها
// ========================================

function openData(id) {
    const q = questionnaires.find(q => q.id === id);
    const respList = responses[id] || [];
    let html = `<h3>داده‌های پرسشنامه: ${escapeHtml(q.name)}</h3>
        <p style="color:var(--text-secondary);">تعداد پاسخ: ${respList.length}</p>
        <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px;">
            <div class="tooltip-container">
                <button id="exportExcelBtn" class="btn glass-btn"><img src="images/export.png" alt="" class="icon-img"></button>
                <span class="tooltip-text">خروجی اکسل (SPSS)</span>
            </div>
            <div class="tooltip-container">
                <button id="exportWordBtn" class="btn glass-btn"><img src="images/word.png" alt="" class="icon-img"></button>
                <span class="tooltip-text">خروجی Word</span>
            </div>
            <div class="tooltip-container">
                <button id="importBackupBtn" class="btn glass-btn"><img src="images/import.png" alt="" class="icon-img"></button>
                <span class="tooltip-text">بارگذاری از فایل</span>
            </div>
            <div class="tooltip-container">
                <button id="printBtn" class="btn glass-btn"><img src="images/print.png" alt="" class="icon-img"></button>
                <span class="tooltip-text">پرینت</span>
            </div>
            <div class="tooltip-container">
                <button id="deleteAllResponsesBtn" class="btn glass-btn"><img src="images/delete.png" alt="" class="icon-img"></button>
                <span class="tooltip-text">حذف همه پاسخ‌ها</span>
            </div>
        </div>`;

    if (respList.length) {
        // نمودار ساده
        html += `<div class="card glass mb-3"><h4>خلاصه آماری</h4><div id="statsChart" style="margin-top:12px;">`;
        const firstQ = q.sections[0]?.questions[0];
        if (firstQ && firstQ.options) {
            const counts = {};
            firstQ.options.forEach(o => counts[o.code] = 0);
            respList.forEach(r => {
                const v = r[firstQ.id];
                if (v != null && counts[v] !== undefined) counts[v]++;
            });
            const maxCount = Math.max(...Object.values(counts), 1);
            firstQ.options.forEach(o => {
                const pct = Math.round((counts[o.code] / maxCount) * 100);
                html += `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                        <span>${escapeHtml(o.text)}</span><span>${counts[o.code]} نفر</span></div>
                    <div style="background:var(--border);border-radius:10px;height:20px;overflow:hidden;">
                        <div style="background:linear-gradient(90deg,var(--btn-primary),var(--btn-success));height:100%;width:${pct}%;border-radius:10px;transition:width 0.5s ease;"></div>
                    </div></div>`;
            });
        }
        html += '</div></div>';

        respList.forEach((resp, idx) => {
            let firstQuestion = null, firstValue = '';
            for (let section of q.sections) {
                if (section.questions && section.questions.length) {
                    firstQuestion = section.questions[0];
                    const val = resp[firstQuestion.id];
                    if (val !== undefined && val !== null) {
                        if (Array.isArray(val)) firstValue = val.join(', ');
                        else if (firstQuestion.options) {
                            const opt = firstQuestion.options.find(o => o.code == val);
                            firstValue = opt ? opt.text : val;
                        } else firstValue = val;
                    } else firstValue = '(پاسخ داده نشده)';
                    break;
                }
            }
            const previewText = firstQuestion ? `${firstQuestion.label}: ${firstValue}` : `پاسخ #${idx + 1}`;
            html += `<div class="response-card glass" data-response-index="${idx}">
                <div class="flex-between">
                    <strong>${escapeHtml(previewText)}</strong>
                    <div style="display:flex;gap:6px;">
                        <div class="tooltip-container">
                    <button class="btn btn-warning btn-sm edit-response glass-btn" data-idx="${idx}"><img src="images/edit.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">ویرایش پاسخ</span>
                </div>
                <div class="tooltip-container">
                    <button class="btn btn-danger btn-sm delete-response glass-btn" data-idx="${idx}"><img src="images/delete.png" alt="" class="icon-img"></button>
                    <span class="tooltip-text">حذف پاسخ</span>
                </div>
                    </div>
                </div></div>`;
        });
    } else {
        html += '<p style="text-align:center;padding:30px;opacity:0.7;">هیچ پاسخی ثبت نشده است.</p>';
    }

    document.getElementById('dataPanel').innerHTML = html;

    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportToCSV(id));
    document.getElementById('exportWordBtn')?.addEventListener('click', () => exportToWord(id));
    document.getElementById('printBtn')?.addEventListener('click', () => window.print());

    document.getElementById('deleteAllResponsesBtn')?.addEventListener('click', () => {
        showConfirmModal('هشدار: تمام پاسخ‌های این پرسشنامه برای همیشه حذف خواهند شد. آیا مطمئن هستید؟', () => {
            showPromptModal('برای تأیید نهایی، کلمه "حذف" را وارد کنید:', '', (val) => {
                if (val === 'حذف') {
                    responses[id] = [];
                    saveAll();
                    openData(id);
                    showToast('همه پاسخ‌ها حذف شدند');
                } else {
                    showToast('عملیات لغو شد', true);
                }
            });
        });
    });

    document.getElementById('importBackupBtn')?.addEventListener('click', () => importBackupCSV(id));

    document.querySelectorAll('.edit-response').forEach(btn => btn.addEventListener('click', () => {
        editResponseComplete(id, parseInt(btn.dataset.idx));
    }));

    document.querySelectorAll('.delete-response').forEach(btn => btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        showConfirmModal('آیا این پاسخ حذف شود؟', () => {
            responses[id].splice(idx, 1);
            if (responses[id].length === 0) delete responses[id];
            saveAll();
            openData(id);
            showToast('پاسخ حذف شد');
        });
    }));

    showPage('dataPage');
}

// ========================================
//   خروجی Word
// ========================================

function exportToWord(id) {
    const q = questionnaires.find(q => q.id === id);
    if (!q) return;

    let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>${escapeHtml(q.name)}</title>
    <style>
        body { font-family: 'Kalameh', Tahoma, sans-serif; direction: rtl; padding: 40px; }
        h1 { text-align: center; color: #2c6e9e; border-bottom: 2px solid #2c6e9e; padding-bottom: 10px; }
        h2 { color: #2c6e9e; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .question { margin: 15px 0; padding: 10px; background: #f8fafc; border-radius: 8px; }
        .question-label { font-weight: bold; margin-bottom: 5px; }
        .option { margin: 3px 0; margin-right: 20px; }
        .required { color: red; }
        .line { border-bottom: 1px solid #999; width: 200px; display: inline-block; margin: 0 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td, th { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background: #2c6e9e; color: white; }
    </style></head>
    <body>
    <h1>${escapeHtml(q.name)}</h1>
    <p style="text-align:center;color:#666;">تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</p>`;

    q.sections.forEach((section, secIdx) => {
        html += `<h2>${secIdx + 1}. ${escapeHtml(section.title)}</h2>`;
        (section.questions || []).forEach((question, qIdx) => {
            html += `<div class="question">
                <div class="question-label">${secIdx + 1}.${qIdx + 1}. ${escapeHtml(question.label)} ${question.required ? '<span class="required">*</span>' : ''}</div>`;
            if (question.options && ['radio', 'select', 'likert'].includes(question.type)) {
                question.options.forEach(opt => {
                    html += `<div class="option">○ ${escapeHtml(opt.text)}</div>`;
                });
            } else if (question.options && question.type === 'checkbox') {
                question.options.forEach(opt => {
                    html += `<div class="option">□ ${escapeHtml(opt.text)}</div>`;
                });
            } else if (question.type === 'number') {
                html += `<div>عدد: <span class="line">&nbsp;</span></div>`;
            } else if (question.type === 'text') {
                html += `<div>پاسخ: <span class="line">&nbsp;</span></div>`;
            } else if (question.type === 'textarea') {
                html += `<div>پاسخ:<br><span class="line" style="width:90%;height:60px;display:block;margin-top:5px;border:1px solid #999;border-radius:4px;">&nbsp;</span></div>`;
            } else if (question.type === 'date') {
                html += `<div>تاریخ: <span class="line">&nbsp;</span></div>`;
            }
            html += '</div>';
        });
    });

    html += '</body></html>';

    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${q.name}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('فایل Word دانلود شد');
}

// ========================================
//   Import CSV
// ========================================

function importBackupCSV(questionnaireId) {
    const q = questionnaires.find(q => q.id === questionnaireId);
    if (!q) { showToast('پرسشنامه یافت نشد', true); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const lines = text.split(/\r?\n/);
            if (lines.length < 2) { showToast('فایل خالی است', true); return; }
            const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
            const firstQuestion = q.sections[0]?.questions[0];
            if (!firstQuestion) { showToast('پرسشنامه سوالی ندارد', true); return; }
            if (headers[0] !== firstQuestion.label) {
                showToast(`ستون اول فایل باید "${firstQuestion.label}" باشد`, true);
                return;
            }
            const existingFirstValues = new Set((responses[questionnaireId] || []).map(r => r[firstQuestion.id]));
            const newRecords = [];
            const duplicates = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                let row = [], inQuote = false, current = '';
                for (let ch of lines[i]) {
                    if (ch === '"') inQuote = !inQuote;
                    else if (ch === ',' && !inQuote) { row.push(current); current = ''; }
                    else current += ch;
                }
                row.push(current);
                if (row.length !== headers.length) continue;
                let record = {};
                for (let j = 0; j < headers.length; j++) record[headers[j]] = row[j].replace(/^"|"$/g, '');
                const firstVal = record[firstQuestion.label];
                if (existingFirstValues.has(firstVal) || newRecords.some(r => r[firstQuestion.id] === firstVal)) {
                    duplicates.push(firstVal);
                } else {
                    const answer = {};
                    answer[firstQuestion.id] = firstVal;
                    for (let section of q.sections) {
                        for (let question of (section.questions || [])) {
                            const val = record[question.label];
                            if (val !== undefined) answer[question.id] = val;
                        }
                    }
                    newRecords.push(answer);
                }
            }
            if (duplicates.length > 0) {
                showToast(`تکرار در ${duplicates.length} مقدار. عملیات لغو شد`, true);
                return;
            }
            if (newRecords.length === 0) { showToast('هیچ رکورد جدیدی یافت نشد', true); return; }
            showProgressBar(() => {
                if (!responses[questionnaireId]) responses[questionnaireId] = [];
                responses[questionnaireId].push(...newRecords);
                saveAll();
                openData(questionnaireId);
                showToast(`${newRecords.length} پاسخ جدید اضافه شد`);
            });
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

function showProgressBar(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'progress-overlay';
    overlay.innerHTML = `<div class="progress-card glass">
        <h3>⏳ در حال بارگذاری داده‌ها...</h3>
        <div class="progress-bar"><div class="progress-fill" style="width:0%;"></div></div>
    </div>`;
    document.body.appendChild(overlay);
    const fill = overlay.querySelector('.progress-fill');
    let width = 0;
    const interval = setInterval(() => {
        width += 10;
        if (width >= 100) {
            clearInterval(interval);
            setTimeout(() => { overlay.remove(); if (callback) callback(); }, 200);
        } else fill.style.width = width + '%';
    }, 300);
}

// ========================================
//   ویرایش پاسخ
// ========================================

function editResponseComplete(questionnaireId, responseIndex) {
    const q = questionnaires.find(q => q.id === questionnaireId);
    const resp = responses[questionnaireId][responseIndex];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-content">
        <button class="modal-close-btn" id="closeEditModalTop">${icon('close')}</button>
        <h3>ویرایش پاسخ #${responseIndex + 1}</h3>
        <div id="editForm"></div>
        <div class="flex-between mt-3">
            <button id="closeEditModal" class="btn btn-secondary">انصراف</button>
            <button id="saveEditBtn" class="btn btn-primary">ذخیره تغییرات</button>
        </div></div>`;
    document.body.appendChild(overlay);

    const editFormDiv = document.getElementById('editForm');
    let formHtml = '';
    for (let section of q.sections) {
        for (let question of (section.questions || [])) {
            const currentVal = resp[question.id];
            formHtml += `<div class="mb-2"><label>${escapeHtml(question.label)}</label>`;
            if (question.type === 'text') formHtml += `<input type="text" id="edit_${question.id}" value="${escapeHtml(currentVal || '')}" class="edit-field glass-input">`;
            else if (question.type === 'textarea') formHtml += `<textarea id="edit_${question.id}" class="edit-field glass-input" rows="3">${escapeHtml(currentVal || '')}</textarea>`;
            else if (question.type === 'number') formHtml += `<input type="number" id="edit_${question.id}" value="${currentVal || ''}" class="edit-field glass-input">`;
            else if (question.type === 'radio') {
                formHtml += '<div class="options-group-vertical">';
                question.options.forEach(opt => {
                    const checked = (currentVal == opt.code) ? 'checked' : '';
                    formHtml += `<label class="option-item"><input type="radio" name="edit_radio_${question.id}" value="${opt.code}" ${checked}> ${escapeHtml(opt.text)}</label>`;
                });
                formHtml += '</div>';
            } else if (question.type === 'checkbox') {
                formHtml += '<div class="options-group-vertical">';
                const selectedVals = Array.isArray(currentVal) ? currentVal : [];
                question.options.forEach(opt => {
                    const checked = selectedVals.includes(opt.code) ? 'checked' : '';
                    formHtml += `<label class="option-item"><input type="checkbox" value="${opt.code}" class="edit-checkbox" data-id="${question.id}" ${checked}> ${escapeHtml(opt.text)}</label>`;
                });
                formHtml += '</div>';
            } else if (question.type === 'select') {
                formHtml += `<select id="edit_${question.id}" class="edit-field glass-input"><option value="">انتخاب کنید</option>`;
                question.options.forEach(opt => {
                    const selected = (currentVal == opt.code) ? 'selected' : '';
                    formHtml += `<option value="${opt.code}" ${selected}>${escapeHtml(opt.text)}</option>`;
                });
                formHtml += '</select>';
            } else if (question.type === 'likert') {
                formHtml += '<div class="options-group-vertical">';
                question.options.forEach(opt => {
                    const checked = (currentVal == opt.code) ? 'checked' : '';
                    formHtml += `<label class="option-item"><input type="radio" name="edit_likert_${question.id}" value="${opt.code}" ${checked}> ${escapeHtml(opt.text)}</label>`;
                });
                formHtml += '</div>';
            } else if (question.type === 'date') {
                formHtml += `<input type="text" id="edit_${question.id}" value="${escapeHtml(currentVal || '')}" placeholder="سال/ماه/روز" class="edit-field glass-input">`;
            }
            formHtml += '</div>';
        }
    }
    editFormDiv.innerHTML = formHtml;

    const closeModal = () => overlay.remove();
    document.getElementById('closeEditModalTop').onclick = closeModal;
    document.getElementById('closeEditModal').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    document.getElementById('saveEditBtn').onclick = () => {
        let newAnswer = {};
        for (let section of q.sections) {
            for (let question of (section.questions || [])) {
                if (question.type === 'radio') {
                    const selected = document.querySelector(`input[name="edit_radio_${question.id}"]:checked`);
                    newAnswer[question.id] = selected ? selected.value : null;
                } else if (question.type === 'checkbox') {
                    const checked = Array.from(document.querySelectorAll(`.edit-checkbox[data-id="${question.id}"]:checked`)).map(cb => cb.value);
                    newAnswer[question.id] = checked;
                } else if (question.type === 'likert') {
                    const selected = document.querySelector(`input[name="edit_likert_${question.id}"]:checked`);
                    newAnswer[question.id] = selected ? selected.value : null;
                } else {
                    const input = document.getElementById(`edit_${question.id}`);
                    newAnswer[question.id] = input ? input.value : null;
                }
            }
        }
        const firstQ = q.sections[0]?.questions[0];
        if (firstQ && newAnswer[firstQ.id] !== undefined && !isFirstQuestionUnique(newAnswer[firstQ.id], q)) {
            const originalFirst = resp[firstQ.id];
            if (originalFirst !== newAnswer[firstQ.id]) {
                showToast(`مقدار "${firstQ.label}" باید یکتا باشد`, true);
                return;
            }
        }
        responses[questionnaireId][responseIndex] = newAnswer;
        saveAll();
        closeModal();
        openData(questionnaireId);
        showToast('پاسخ ویرایش شد');
    };
}

// ========================================
//   خروجی CSV (اصلاح شده - کد عددی)
// ========================================

function exportToCSV(id) {
    const q = questionnaires.find(q => q.id === id);
    const respList = responses[id] || [];
    if (!respList.length) { showToast('داده‌ای برای خروجی نیست', true); return; }
    let headers = [];
    for (let section of q.sections) for (let question of (section.questions || [])) headers.push(question.label);
    const rows = respList.map(resp => {
        let row = [];
        for (let section of q.sections) {
            for (let question of (section.questions || [])) {
                let val = resp[question.id];
                let displayVal = '';
                if (val !== undefined && val !== null) {
                    if (Array.isArray(val)) {
                        displayVal = val.join(';');
                    } else {
                        displayVal = val;
                    }
                }
                row.push(displayVal);
            }
        }
        return row;
    });
    let csv = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n' +
        rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${q.name}_data.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('خروجی گرفته شد');
}

// ========================================
//   تنظیمات ظاهری
// ========================================

function applyCustomTheme() {
    document.documentElement.style.setProperty('--btn-primary', document.getElementById('primaryColor').value);
    document.documentElement.style.setProperty('--bg-card', document.getElementById('cardBgColor').value);
    document.documentElement.style.setProperty('--text-primary', document.getElementById('textColor').value);
    const font = document.getElementById('fontSelect').value;
    document.body.style.fontFamily = font === 'Kalameh' ? "'Kalameh', system-ui" : font;
    localStorage.setItem(STORAGE_THEME, JSON.stringify({
        primary: document.getElementById('primaryColor').value,
        cardBg: document.getElementById('cardBgColor').value,
        textColor: document.getElementById('textColor').value, font
    }));
    showToast('تنظیمات ظاهری اعمال شد');
}

function resetSettingsForm() {
    document.getElementById('primaryColor').value = DEFAULT_PRIMARY;
    document.getElementById('cardBgColor').value = DEFAULT_CARD_BG;
    document.getElementById('textColor').value = DEFAULT_TEXT_COLOR;
    document.getElementById('fontSelect').value = 'Kalameh';
    showToast('مقادیر به حالت پیش‌فرض برگشت. برای اعمال کلیک کنید.');
}

function loadTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved) {
        const t = JSON.parse(saved);
        if (t.primary) document.documentElement.style.setProperty('--btn-primary', t.primary);
        if (t.cardBg) document.documentElement.style.setProperty('--bg-card', t.cardBg);
        if (t.textColor) document.documentElement.style.setProperty('--text-primary', t.textColor);
        if (t.font) {
            document.getElementById('fontSelect').value = t.font;
            document.body.style.fontFamily = t.font === 'Kalameh' ? "'Kalameh', system-ui" : t.font;
        }
        document.getElementById('primaryColor').value = t.primary || DEFAULT_PRIMARY;
        document.getElementById('cardBgColor').value = t.cardBg || DEFAULT_CARD_BG;
        document.getElementById('textColor').value = t.textColor || DEFAULT_TEXT_COLOR;
    } else {
        document.getElementById('primaryColor').value = DEFAULT_PRIMARY;
        document.getElementById('cardBgColor').value = DEFAULT_CARD_BG;
        document.getElementById('textColor').value = DEFAULT_TEXT_COLOR;
        document.body.style.fontFamily = "'Kalameh', system-ui";
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('porsa_dark', document.body.classList.contains('dark'));
    const btn = document.getElementById('darkModeToggle');
    if (btn) btn.innerHTML = document.body.classList.contains('dark') ? '<img src="images/sun.png" alt="" class="icon-img">' : '<img src="images/moon.png" alt="" class="icon-img">';;
}

function loadDarkMode() {
    if (localStorage.getItem('porsa_dark') === 'true') {
        document.body.classList.add('dark');
        document.getElementById('darkModeToggle').innerHTML = '<img src="images/sun.png" alt="" class="icon-img">';
    }
}

// ========================================
//   راهنما
// ========================================

function showHelpModal() {
    const faqs = [
        { q: "چگونه پرسشنامه جدید بسازم؟", a: "در صفحه اصلی، دکمه پرسشنامه جدید را بزنید. سپس نام پرسشنامه را وارد کرده و با دکمه افزودن بخش جدید بخش‌ها و سپس با افزودن سوال جدید سوالات خود را طراحی کنید." },
        { q: "چگونه شرط نمایش (وابستگی سوالات) تعریف کنم؟", a: "هنگام ساخت یا ویرایش سوال، تیک «شرط نمایش» را بزنید. سوال مبدأ (از سوالات قبلی) را انتخاب کنید، عملگر (مثلاً برابر باشد با) و مقدار شرط را که همان کد عددی گزینه است وارد کنید." },
        { q: "قانون یکتایی سوال اول چیست؟", a: "اولین سوال هر پرسشنامه به عنوان شناسه یکتا در نظر گرفته می‌شود. هنگام ثبت پاسخ جدید، اگر مقدار این سوال قبلاً ثبت شده باشد، خطا می‌گیرید." },
        { q: "چگونه از پاسخ‌های قبلی پشتیبان بگیرم؟", a: "در صفحه داده‌ها، دکمه «بارگذاری پاسخ از فایل» را بزنید. فایل CSV باید همنام پرسشنامه باشد. ستون اول باید با اولین سوال پرسشنامه مطابقت داشته باشد." },
        { q: "چطور پاسخ‌ها را ویرایش یا حذف کنم؟", a: "در صفحه داده‌ها، هر پاسخ به صورت پیش‌نمایش نمایش داده می‌شود. با کلیک روی «ویرایش کامل» می‌توانید تمام سوالات را ویرایش کنید." },
        { q: "آیا برنامه پاسخ‌ها را به صورت خودکار ذخیره می‌کند؟", a: "بله. در صفحه پاسخگویی، هر بار که به سوالی پاسخ می‌دهید، پس از ۸۰۰ میلی‌ثانیه پاسخ‌ها به صورت پیش‌نویس ذخیره می‌شوند." },
        { q: "چطور سوالات را جابه‌جا یا کپی کنم؟", a: "در صفحه ویرایش پرسشنامه، کنار هر بخش و هر سوال دکمه‌های بالا/پایین (▲/▼) برای تغییر ترتیب وجود دارد. همچنین می‌توانید با کشیدن (Drag & Drop) سوالات را جابجا کنید." },
        { q: "چگونه از داده‌ها خروجی بگیرم؟", a: "در صفحه داده‌ها، دکمه‌های خروجی اکسل (SPSS) و خروجی Word وجود دارد. خروجی اکسل کدهای عددی را ذخیره می‌کند." },
        { q: "آیا می‌توانم سوال را قفل کنم؟", a: "بله، با کلیک روی آیکون قفل کنار هر سوال، آن را قفل کنید تا ویرایش یا حذف نشود." },
        { q: "چگونه از تغییرات خود بازگردانی کنم؟", a: "با Ctrl+Z می‌توانید آخرین تغییر خود را بازگردانی کنید." },
        { q: "آیا می‌توانم پرسشنامه را پرینت بگیرم؟", a: "بله! در صفحه داده‌ها دکمه پرینت وجود دارد یا می‌توانید از خروجی Word استفاده کنید." },
        { q: "آیا برنامه رایگان است؟", a: "بله، پرسا کاملاً رایگان و بدون هیچ هزینه‌ای است." }
    ];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-content">
        <button class="modal-close-btn" id="closeHelpModal">${icon('close')}</button>
        <h2><img src="images/book.png" alt="" class="icon-img" style="width:24px;height:24px;"> راهنمای پرسا (Porsa)</h2>
        <p style="margin-bottom:12px;"><strong><img src="images/check.png" alt="" class="icon-img" style="width:16px;height:16px;"> رایگان و بدون نیاز به اینترنت</strong></p>
        <hr class="glass-hr">
        <h3><img src="images/faq.png" alt="" class="icon-img" style="width:20px;height:20px;"> سوالات متداول</h3>
        <div id="faqContainer"></div>
        <hr class="glass-hr">
        <div style="font-size:0.9rem;background:var(--bg-card);padding:14px;border-radius:16px;">
            <strong><img src="images/dev.png" alt="" class="icon-img" style="width:16px;height:16px;"> توسعه‌دهنده:</strong> آریان فقیه سلیمانی<br>
            <strong><img src="images/edu.png" alt="" class="icon-img" style="width:16px;height:16px;"> دانشجوی پزشکی دانشگاه علوم پزشکی تبریز</strong><br>
            <strong><img src="images/date.png" alt="" class="icon-img" style="width:16px;height:16px;"> تاریخ ساخت:</strong> اردیبهشت ماه ۱۴۰۵<br>
            <strong><img src="images/email.png" alt="" class="icon-img" style="width:16px;height:16px;"> ایمیل:</strong> aryam.2001.fs@gmail.com
        </div></div>`;
    document.body.appendChild(overlay);

    const faqContainer = document.getElementById('faqContainer');
    faqs.forEach((faq, idx) => {
        const faqDiv = document.createElement('div');
        faqDiv.className = 'faq-item';
        faqDiv.innerHTML = `<div class="faq-question" data-idx="${idx}">
            <span>${escapeHtml(faq.q)}</span><span class="toggle-icon">▼</span></div>
            <div class="faq-answer" id="faq-answer-${idx}">${escapeHtml(faq.a)}</div>`;
        faqContainer.appendChild(faqDiv);
        const qDiv = faqDiv.querySelector('.faq-question');
        const aDiv = faqDiv.querySelector('.faq-answer');
        let open = false;
        qDiv.addEventListener('click', () => {
            open = !open;
            aDiv.classList.toggle('show', open);
            qDiv.querySelector('.toggle-icon').innerHTML = open ? '▲' : '▼';
        });
    });

    const closeModal = () => overlay.remove();
    document.getElementById('closeHelpModal').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

// ========================================
//   بارگذاری داده‌ها
// ========================================

function loadData() {
    const storedQs = localStorage.getItem(STORAGE_QS);
    if (storedQs) questionnaires = JSON.parse(storedQs);
    else questionnaires = [];
    const storedResp = localStorage.getItem(STORAGE_RESP);
    if (storedResp) responses = JSON.parse(storedResp);
    else responses = {};
    renderDashboard();
}

// ========================================
//   رویدادها
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // دکمه‌های اصلی
    document.getElementById('newQuestionnaireBtn').onclick = () => openBuilder();
    document.getElementById('settingsBtn').onclick = () => showPage('settingsPage');
    document.getElementById('darkModeToggle').onclick = toggleDarkMode;
    document.getElementById('applySettingsBtn').onclick = applyCustomTheme;
    document.getElementById('resetSettingsBtn').onclick = resetSettingsForm;
    document.getElementById('restoreSampleBtn').onclick = restoreSampleManually;
    document.getElementById('addSectionBtn')?.addEventListener('click', () => {
        pushUndo();
        tempSections.push({ title: 'بخش جدید', questions: [] });
        renderBuilderSections();
        updateCounter();
        autoSaveBuilderDraft();
    });
    document.getElementById('saveQuestionnaireBtn').onclick = saveQuestionnaire;
    document.getElementById('submitResponseBtn').onclick = () => submitResponse(false);
    document.getElementById('submitAndExitBtn').onclick = () => submitResponse(true);
    document.getElementById('clearFormBtn').onclick = clearResponseForm;
    document.querySelectorAll('.backBtn').forEach(btn => btn.onclick = backToDashboard);
    document.getElementById('helpBtn').onclick = showHelpModal;
    document.getElementById('previewBtn').onclick = showPreview;

    // جستجو
    document.getElementById('searchBtn').onclick = () => {
        const bar = document.getElementById('searchBar');
        bar.classList.toggle('hidden');
        if (!bar.classList.contains('hidden')) document.getElementById('searchInput').focus();
    };
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderDashboard(e.target.value);
    });

    // کلیدهای میانبر
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        }
        // Ctrl+Z برای undo
        if (e.ctrlKey && e.key === 'z' && document.getElementById('builderPage').classList.contains('active')) {
            e.preventDefault();
            undo();
        }
    });

    // ثبت Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(e => console.log('SW error', e));
    }

    // بارگذاری اولیه
    loadDarkMode();
    loadTheme();
    loadData();
    createSampleOnce();
});
