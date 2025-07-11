// Firebase Initialization
const firebaseConfig = {
    apiKey: "AIzaSyD_IkGO-INZZqU4BNuPwMEaHHv033yZe_c",
    authDomain: "auto-book-new.firebaseapp.com",
    projectId: "auto-book-new",
    storageBucket: "auto-book-new.firebasestorage.app",
    messagingSenderId: "104184882242",
    appId: "1:104184882242:web:57194b9977021385e339db"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// App Logic wrapped in an IIFE
(() => {
    // --- Global State ---
    let currentUser = null;
    let entries = [];
    let messages = [];
    let autos = [];
    let installmentPlans = [];
    let editingPlanId = null; // কোন প্ল্যানটি এডিট করা হচ্ছে তা ট্র্যাক করার জন্য
    let showCash = false;
    let darkMode = localStorage.getItem('darkMode') === 'true';

    // --- DOM Elements (will be initialized later) ---
   let splash, sideMenu, mainContent, entryForm, entriesDiv, cashLabel, todaySummary, unreadCount, darkModeToggle, reportContent, messagesList, autoListDiv, reportAutoFilter, installmentPlanForm;
     
    const sections = {};

    // --- Utility Functions ---
    const playSound = (type) => {
        const audioElement = document.getElementById(`${type}Sound`);
        if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.play().catch(e => console.warn(`Audio play failed for ${type}:`, e));
        }
    };

       const showSection = (sectionName) => {
        // Hide all main sections and forms
        Object.values(sections).forEach(section => section.classList.add('hidden'));
        if (entryForm) entryForm.classList.remove('show');
        if (installmentPlanForm) installmentPlanForm.classList.remove('show');
        
        // Show the selected section
        if (sections[sectionName]) {
            sections[sectionName].classList.remove('hidden');
            // Hide main content if another section is shown
            mainContent.style.display = (sectionName === 'main') ? 'block' : 'none';
        } else if (sectionName === 'main') {
            mainContent.style.display = 'block';
        }
        
        // Close side menu and remove blur
        if (sideMenu) sideMenu.classList.remove('show');
        if (mainContent) mainContent.style.filter = 'none';
    };
    
        // --- Auto Management ---
    const renderAutos = () => {
        if (!autoListDiv) return;
        
        // Settings Page Auto List
        autoListDiv.innerHTML = autos.length > 0 ?
            autos.map(auto => `
                <div class="auto-list-item">
                    <span>${auto.name}</span>
                    <button class="delete-auto-btn" onclick="window.app.removeAuto('${auto.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('') :
            '<p class="settings-description">কোনো গাড়ি যোগ করা হয়নি।</p>';
        
        // Entry Form Dropdown
        const autoSelect = document.getElementById('autoSelect');
        if (autoSelect) {
            const currentVal = autoSelect.value;
            autoSelect.innerHTML = '<option value="">গাড়ি নির্বাচন করুন</option>';
            autos.forEach(auto => {
                const option = document.createElement('option');
                option.value = auto.name;
                option.textContent = auto.name;
                autoSelect.appendChild(option);
            });
            if (autos.some(a => a.name === currentVal)) {
                autoSelect.value = currentVal;
            }
        }
        
        // Report Page Filter Dropdown
        if (reportAutoFilter) {
            const currentVal = reportAutoFilter.value;
            reportAutoFilter.innerHTML = '<option value="all">সব অটো</option>';
            autos.forEach(auto => {
                const option = document.createElement('option');
                option.value = auto.name;
                option.textContent = auto.name;
                reportAutoFilter.appendChild(option);
            });
            if (autos.some(a => a.name === currentVal) || currentVal === 'all') {
                reportAutoFilter.value = currentVal;
            }
        }
        
            // Installment Plan Form Dropdown
        const installmentAutoSelect = document.getElementById('installmentAutoSelect');
        if (installmentAutoSelect) {
            const autosWithPlans = installmentPlans.map(p => p.autoName);
            const availableAutos = autos.filter(a => !autosWithPlans.includes(a.name));
            
            installmentAutoSelect.innerHTML = '<option value="">গাড়ি নির্বাচন করুন</option>';
            availableAutos.forEach(auto => {
                const option = document.createElement('option');
                option.value = auto.name;
                option.textContent = auto.name;
                installmentAutoSelect.appendChild(option);
            });
        }
    
    
    };
    
         const updateInstallmentReminder = () => {
        const reminderDiv = document.getElementById('installmentReminder');
        if (!reminderDiv) return;
        
        let nextInstallment = null;
        
               installmentPlans.forEach(plan => {
            const totalInstallments = Math.round(plan.totalDue / plan.installmentAmount);
            const paidCount = plan.payments ? plan.payments.length : 0;
            
            if (paidCount >= totalInstallments) {
                return; // প্ল্যান সম্পন্ন হলে এই লুপ থেকে বেরিয়ে যাওয়া হবে
            }
            
            // --- সঠিক মাসিক তারিখ হিসাব করার নতুন লজিক ---
            // প্রতিটি হিসাবের জন্য একটি নতুন 'Date' অবজেক্ট তৈরি করা হচ্ছে
            const firstDate = new Date(plan.firstInstallmentDate + 'T00:00:00'); // সময় অঞ্চল সমস্যা এড়ানোর জন্য
            
            // পরবর্তী কিস্তির তারিখ হিসাব করা হচ্ছে প্রথম তারিখের সাথে পরিশোধিত মাস যোগ করে
            const nextDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + paidCount, firstDate.getDate());
            
            if (!nextInstallment || nextDate < nextInstallment.date) {
                nextInstallment = {
                    date: nextDate,
                    plan: plan
                };
            }
        });
        
        if (nextInstallment) {
            const daysLeft = Math.ceil((nextInstallment.date - new Date()) / (1000 * 60 * 60 * 24));
            let dayText = '';
            if (daysLeft < 0) {
                dayText = ' (সময় পার হয়েছে)';
            } else if (daysLeft === 0) {
                dayText = ' (আজ)';
            } else if (daysLeft === 1) {
                dayText = ' (আগামীকাল)';
            } else {
                dayText = ` (${daysLeft} দিন বাকি)`;
            }
            
            reminderDiv.innerHTML = `
                <div class="icon">💰</div>
                <h5>পরবর্তী কিস্তি রিমাইন্ডার</h5>
                <p>
                    <strong>${nextInstallment.plan.autoName}</strong>-এর কিস্তি 
                    ${nextInstallment.date.toLocaleDateString('bn-BD')} তারিখে 
                    <strong>${nextInstallment.plan.installmentAmount.toLocaleString('bn-BD')} ৳</strong>
                    ${dayText}
                </p>
            `;
            reminderDiv.classList.remove('hidden');
        } else {
            reminderDiv.classList.add('hidden');
        }
    };
    

         // --- Installment Management ---
    const renderInstallmentPlans = () => {
        const plansListDiv = document.getElementById('installmentPlansList');
        const paymentListDiv = document.getElementById('installmentPaymentList');
        
        if (!plansListDiv || !paymentListDiv) return;
        
        plansListDiv.innerHTML = '';
        paymentListDiv.innerHTML = '';
        
        if (installmentPlans.length === 0) {
            const noPlanMsg = '<p class="settings-description" style="text-align:center; padding: 2rem 0;">কোনো কিস্তির প্ল্যান যোগ করা হয়নি।</p>';
            plansListDiv.innerHTML = noPlanMsg;
            paymentListDiv.innerHTML = noPlanMsg;
            return;
        }
        
        installmentPlans.forEach(plan => {
             const totalInstallments = Math.round(plan.totalDue / plan.installmentAmount);
            const paidInstallments = plan.payments ? plan.payments.length : 0;
            const progress = (paidInstallments / totalInstallments) * 100;
            const isCompleted = paidInstallments >= totalInstallments;
            
            // --- Card for Plan Management Tab ---
            const planCard = `
                <div class="installment-card ${isCompleted ? 'completed' : ''}">
                    <h4>${plan.autoName}</h4>
                    <div class="info-grid">
                        <p>মোট মূল্য: <span>${plan.totalPrice.toLocaleString('bn-BD')} ৳</span></p>
                        <p>ডাউন পেমেন্ট: <span>${plan.downPayment.toLocaleString('bn-BD')} ৳</span></p>
                        <p>মাসিক কিস্তি: <span>${plan.installmentAmount.toLocaleString('bn-BD')} ৳</span></p>
                        <p>মোট কিস্তি: <span>${totalInstallments} টি</span></p>
                    </div>
                    <div class="card-actions">
                    
                    <button class="action-btn" style="background-color: #f59e0b;" onclick="window.app.editInstallmentPlan('${plan.id}')">এডিট করুন</button>
                        <button class="action-btn details-btn" style="background-color: #ef4444;" onclick="window.app.deleteInstallmentPlan('${plan.id}')">প্ল্যান মুছুন</button>
                    </div>
                </div>
            `;
            plansListDiv.innerHTML += planCard;
            
            // --- Card for Payment Tab ---
            const paymentCard = `
                 <div class="installment-card ${isCompleted ? 'completed' : ''}">
                    <h4>${plan.autoName}</h4>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${isCompleted ? 'completed' : ''}" style="width: ${progress}%">${Math.round(progress)}%</div>
                    </div>
                     <div class="info-grid">
                        <p>পরিশোধিত: <span>${paidInstallments}/${totalInstallments} টি</span></p>
                        <p>বাকি টাকা: <span>${(plan.totalDue - (paidInstallments * plan.installmentAmount)).toLocaleString('bn-BD')} ৳</span></p>
                    </div>
                    ${isCompleted 
                        ? `<p style="color: #4ade80; text-align:center; font-weight:bold;">🎉 অভিনন্দন! সব কিস্তি পরিশোধিত।</p>` 
                        : `<div class="card-actions">
 
 
                <button class="action-btn pay-btn" onclick="window.app.payInstallment('${plan.id}', event)" ${isCompleted ? 'disabled' : ''}>কিস্তি পরিশোধ করুন</button>
                               <button class="action-btn details-btn" onclick="window.app.showPaymentHistory('${plan.id}')">বিস্তারিত দেখুন</button>
                           </div>`
                    }
                </div>
            `;
            paymentListDiv.innerHTML += paymentCard;
        });
    };

    const addMessage = (text) => {
        if (!currentUser) return;
        db.collection("messages").add({
            text, userId: currentUser.uid, time: new Date().toISOString(), read: false
        }).catch(e => console.error("Error adding message:", e));
    };

    // --- UI Update Functions ---
    const updateUnreadBadge = () => {
        if (!unreadCount) return;
        const unreadMessagesCount = messages.filter(m => !m.read).length;
        unreadCount.textContent = unreadMessagesCount > 0 ? unreadMessagesCount : '';
        unreadCount.classList.toggle('hidden', unreadMessagesCount === 0);
    };

    const renderEntries = () => {
        if (!entriesDiv) return;
        entriesDiv.innerHTML = entries.length === 0 ?
            '<p style="text-align:center; color:#888; margin-top:1rem;">কোন এন্ট্রি নেই।</p>' :
            entries.map(entry => `
        <div class="entry-item">
            <div class="entry-details">
                <strong>${entry.date} | ${entry.auto || '-'}</strong><br>
                <span class="entry-type ${entry.type}">${entry.type === 'income' ? 'আয়' : 'ব্যয়'}: ${entry.amount.toLocaleString('bn-BD')} টাকা</span><br>
                <small>বর্ণনা: ${entry.description || '-'}</small><br>
                ${entry.entryBy ? `<small>এন্ট্রি কারী: ${entry.entryBy} (@${entry.username || 'N/A'})</small>` : ''}
            </div>
            <button class="remove-btn" title="মুছে ফেলুন" onclick="window.app.removeEntry('${entry.id}')">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
    };

    const renderMessages = () => {
        if (!messagesList) return;
        messagesList.innerHTML = '';
        if (messages.length === 0) {
            messagesList.innerHTML = '<li style="text-align:center; color:#888;">কোন মেসেজ নেই।</li>';
            return;
        }
        messages.forEach((msg) => {
            const li = document.createElement('li');
            const timeObj = msg.time ? new Date(msg.time) : new Date();
            const formattedTime = timeObj.toLocaleString('bn-BD', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
            const isDarkMode = document.body.classList.contains('dark');
            let messageStyle = !msg.read ? `font-weight: bold; color: ${isDarkMode ? 'var(--text-light)' : 'var(--text-dark)'};` : `color: ${isDarkMode ? 'var(--text-gray)' : '#666'};`;
            li.innerHTML = `<div style="padding: 10px 5px; border-bottom: 1px solid ${isDarkMode ? '#333' : '#eee'};"><div><span style="font-weight: bold; color: #10b981;">•</span> <span style="${messageStyle}">${msg.text}</span></div><div style="font-size: 0.8rem; color: var(--text-gray); padding-top: 4px; text-align: left;"><small>📅 ${formattedTime}</small></div></div>`;
            li.style.cursor = 'pointer';
            li.onclick = () => { if (!msg.read && msg.id) db.collection('messages').doc(msg.id).update({ read: true }); };
            messagesList.appendChild(li);
        });
    };

    const updateCashDisplays = () => {
        if (!cashLabel) return;
        const totalCash = entries.reduce((sum, e) => (e.type === 'income' ? sum + e.amount : sum - e.amount), 0);
        cashLabel.textContent = showCash ? `${totalCash.toLocaleString('bn-BD')} টাকা` : '••••••';
    };

    const updateTodaySummary = () => {
        if (!todaySummary) return;
        const today = new Date().toISOString().slice(0, 10);
        const todayEntries = entries.filter((e) => e.date === today);
        let inc = 0, exp = 0;
        todayEntries.forEach(e => (e.type === 'income' ? inc += e.amount : exp += e.amount));
        todaySummary.textContent = `আজকের মোট আয়: ${inc.toLocaleString('bn-BD')} টাকা | মোট ব্যয়: ${exp.toLocaleString('bn-BD')} টাকা | নিট ক্যাশ: ${(inc - exp).toLocaleString('bn-BD')} টাকা`;
    };

    const clearEntryInputs = () => {
        if (!entryForm) return;
        document.getElementById('autoSelect').value = '';
        document.getElementById('dateInput').valueAsDate = new Date();
        document.querySelector('input[name="type"][value="income"]').checked = true;
        document.getElementById('amountInput').value = '';
        document.getElementById('descriptionInput').value = '';
        document.getElementById('entryByInput').value = '';
    };

    const generateReportContent = () => {
        const reportContentDiv = document.getElementById('reportContent');
        const reportSummaryDiv = document.getElementById('reportSummary');
        if (!reportContentDiv || !reportSummaryDiv) return;

        reportSummaryDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> রিপোর্ট জেনারেট হচ্ছে...</p>';
        reportContentDiv.innerHTML = '';

        setTimeout(() => {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const selectedAuto = document.getElementById('autoFilter').value;
            let filteredEntries = entries.filter(entry => {
                const isAfterStartDate = startDate ? entry.date >= startDate : true;
                const isBeforeEndDate = endDate ? entry.date <= endDate : true;
                const isCorrectAuto = (selectedAuto !== 'all') ? (entry.auto === selectedAuto) : true;
                return isAfterStartDate && isBeforeEndDate && isCorrectAuto;
            });

            if (filteredEntries.length > 0) {
                const totalIncome = filteredEntries.reduce((sum, e) => (e.type === 'income' ? sum + e.amount : sum), 0);
                const totalExpense = filteredEntries.reduce((sum, e) => (e.type === 'expense' ? sum + e.amount : sum), 0);
                reportSummaryDiv.innerHTML = `<p><strong>মোট আয়:</strong> ${totalIncome.toLocaleString('bn-BD')} টাকা</p><p><strong>মোট ব্যয়:</strong> ${totalExpense.toLocaleString('bn-BD')} টাকা</p><p><strong>নিট লাভ/ক্ষতি:</strong> ${(totalIncome - totalExpense).toLocaleString('bn-BD')} টাকা</p>`;
                reportContentDiv.innerHTML = `<table><thead><tr><th>তারিখ</th><th>অটো</th><th>ধরন</th><th>টাকা</th><th>বর্ণনা</th><th>এন্ট্রি কারী</th><th>ইউজারনেম (ID)</th></tr></thead><tbody>${filteredEntries.map(e => `<tr><td>${e.date}</td><td>${e.auto || '-'}</td><td>${e.type === 'income' ? 'আয়' : 'ব্যয়'}</td><td>${e.amount.toLocaleString('bn-BD')}</td><td>${e.description || '-'}</td><td>${e.entryBy || '-'}</td><td>@${e.username || 'N/A'}</td></tr>`).join('')}</tbody></table>`;
            } else {
                reportSummaryDiv.innerHTML = '<p>এই ফিল্টারে কোনো হিসাব পাওয়া যায়নি।</p>';
                reportContentDiv.innerHTML = '';
            }
        }, 250);
    };

    // --- Global App Object for onclick events ---
    window.app = {
        toggleMenu: () => { if (sideMenu) sideMenu.classList.toggle('show'); },
        logoutUser: () => {
            Swal.fire({ title: 'লগআউট করবেন?', icon: 'question', showCancelButton: true, confirmButtonText: 'হ্যাঁ', cancelButtonText: 'না' })
            .then((result) => { if (result.isConfirmed) auth.signOut(); });
        },
        toggleDarkMode: () => {
            darkMode = !darkMode;
            document.body.classList.toggle('dark', darkMode);
            if (darkModeToggle) {
                darkModeToggle.classList.toggle('fa-sun', darkMode);
                darkModeToggle.classList.toggle('fa-moon', !darkMode);
            }
            localStorage.setItem('darkMode', darkMode);
        },
        showEntryForm: () => { if (entryForm) { entryForm.classList.add('show'); mainContent.style.filter = 'blur(4px)'; clearEntryInputs(); document.getElementById('autoSelect').focus(); } },
        hideEntryForm: () => { if (entryForm) { entryForm.classList.remove('show'); mainContent.style.filter = 'none'; } },
        addEntry: async () => {
            if (!currentUser) return Swal.fire({ icon: 'error', title: 'ত্রুটি', text: 'ব্যবহারকারীর তথ্য লোড হয়নি।' });
            
            const entryData = {
                auto: document.getElementById('autoSelect').value.trim(),
                date: document.getElementById('dateInput').value,
                type: document.querySelector('input[name="type"]:checked').value,
                amount: parseFloat(document.getElementById('amountInput').value),
                description: document.getElementById('descriptionInput').value.trim(),
                entryByInput: document.getElementById('entryByInput').value.trim()
            };
            
            if (!entryData.date || isNaN(entryData.amount) || entryData.amount <= 0) {
                playSound('error');
                return Swal.fire({ icon: 'warning', title: 'ফর্ম পূরণ করুন', text: 'অনুগ্রহ করে তারিখ এবং টাকার সঠিক পরিমাণ লিখুন।' });
            }

            const submitBtn = document.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'জমা হচ্ছে... <i class="fas fa-spinner fa-spin"></i>';

            const newEntry = {
                auto: entryData.auto, date: entryData.date, type: entryData.type, amount: entryData.amount, description: entryData.description,
                entryBy: entryData.entryByInput || currentUser.displayName,
                username: currentUser.username,
                userId: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection("entries").add(newEntry);
                playSound('submit');
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'এন্ট্রি যোগ হয়েছে!', showConfirmButton: false, timer: 2000, timerProgressBar: true, customClass: { popup: 'animated-gradient-bg' } });
                addMessage(`নতুন এন্ট্রি: ${newEntry.type === 'income' ? 'আয়' : 'ব্যয়'} - ${newEntry.amount} টাকা`);
                window.app.hideEntryForm();
            } catch (e) {
                console.error("Error adding entry:", e);
                playSound('error');
                Swal.fire({ icon: 'error', title: 'ব্যর্থ', text: 'এন্ট্রি যোগ করতে একটি সমস্যা হয়েছে।' });
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '✅ জমা দিন';
            }
        },
        removeEntry: (id) => {
            Swal.fire({ title: 'আপনি কি নিশ্চিত?', text: "এই এন্ট্রিটি মুছে ফেলার পর আর ফেরত আনা যাবে না!", icon: 'warning', showCancelButton: true, confirmButtonText: 'হ্যাঁ, মুছে ফেলুন!', cancelButtonText: 'না, থাক' })
            .then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await db.collection("entries").doc(id).delete();
                        playSound('delete');
                        addMessage('একটি এন্ট্রি মুছে ফেলা হয়েছে।');
                        Swal.fire('মুছে ফেলা হয়েছে!', 'আপনার এন্ট্রিটি সফলভাবে মুছে ফেলা হয়েছে।', 'success');
                    } catch (e) {
                        console.error("Error removing entry:", e);
                        Swal.fire({ icon: 'error', title: 'ব্যর্থ', text: 'এন্ট্রিটি মুছতে একটি সমস্যা হয়েছে।' });
                    }
                }
            });
        },
        toggleCash: () => { showCash = !showCash; updateCashDisplays(); },
        hideToday: () => { if (todaySummary) todaySummary.parentElement.classList.add('hidden'); },
        showDashboard: () => { showSection('main'); updateTodaySummary(); },
        showMessages: () => { showSection('messages'); renderMessages(); },
        
        
        showSettings: () => showSection('settings'),
        showAbout: () => showSection('about'),
        backToDashboard: () => showSection('main'),
        showReport: () => {
            showSection('report');
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            if (!startDateInput.value || !endDateInput.value) {
                const today = new Date();
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
                const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
                startDateInput.value = firstDayOfMonth;
                endDateInput.value = lastDayOfMonth;
            }
            generateReportContent();
            
           
        },
        generateReportContent: generateReportContent,
        
                addAuto: async () => {
                if (!currentUser) return;
                const newAutoNameInput = document.getElementById('newAutoNameInput');
                const name = newAutoNameInput.value.trim();
                if (!name) {
                    return Swal.fire({ icon: 'error', title: 'নাম দিন', text: 'গাড়ির একটি নাম বা নাম্বার দিন।' });
                }
                
                const addBtn = document.getElementById('addAutoBtn');
                addBtn.disabled = true;
                addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                try {
                    // Firestore এ নতুন গাড়ি যোগ করা
                    await db.collection("users").doc(currentUser.uid).collection("autos").add({
                        name: name,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    newAutoNameInput.value = '';
                    playSound('submit');
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'গাড়ি যোগ হয়েছে!', showConfirmButton: false, timer: 1500 });
                } catch (error) {
                    console.error("Error adding auto:", error);
                    Swal.fire({ icon: 'error', title: 'ব্যর্থ', text: 'একটি সমস্যা হয়েছে।' });
                } finally {
                    addBtn.disabled = false;
                    addBtn.innerHTML = '+ গাড়ি যোগ করুন';
                }
            },
            removeAuto: (id) => {
                if (!currentUser) return;
                Swal.fire({
                    title: 'আপনি কি নিশ্চিত?',
                    text: "এই গাড়িটি তালিকা থেকে মুছে যাবে!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'হ্যাঁ, মুছে ফেলুন!',
                    cancelButtonText: 'না'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        try {
                            await db.collection("users").doc(currentUser.uid).collection("autos").doc(id).delete();
                            playSound('delete');
                            Swal.fire('মুছে ফেলা হয়েছে!', 'গাড়িটি সফলভাবে মুছে ফেলা হয়েছে।', 'success');
                        } catch (error) {
                            console.error("Error removing auto:", error);
                            Swal.fire('ব্যর্থ!', 'গাড়িটি মুছতে সমস্যা হয়েছে।', 'error');
                        }
                    }
                });
            },
        
        downloadPDF: async () => {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const selectedAuto = document.getElementById('autoFilter').value;
            let filteredEntries = entries.filter(entry => {
                const isAfterStartDate = startDate ? entry.date >= startDate : true;
                const isBeforeEndDate = endDate ? entry.date <= endDate : true;
                const isCorrectAuto = (selectedAuto !== 'all') ? (entry.auto === selectedAuto) : true;
                return isAfterStartDate && isBeforeEndDate && isCorrectAuto;
            });
            if (filteredEntries.length === 0) return Swal.fire({ icon: 'info', title: 'ডেটা নেই', text: 'PDF তৈরির মতো কোনো এন্ট্রি এই ফিল্টারে পাওয়া যায়নি।' });
            
            Swal.fire({ title: 'PDF ডাউনলোড হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "landscape" });
                doc.addFont('Kalpurush.ttf', 'Kalpurush', 'normal');
                doc.setFont('Kalpurush');
                const headers = [["তারিখ", "অটো", "ধরন", "টাকা", "বর্ণনা", "এন্ট্রি কারী", "ইউজারনেম (ID)"]];
                const rows = filteredEntries.map(e => [e.date, e.auto || '-', e.type === 'income' ? 'আয়' : 'ব্যয়', e.amount.toLocaleString('bn-BD'), e.description || '-', e.entryBy || '-', `@${e.username || 'N/A'}`]);
                doc.text(`রিপোর্ট (${startDate || 'শুরু'} থেকে ${endDate || 'শেষ'})`, 14, 15);
                doc.autoTable({ head: headers, body: rows, startY: 20, theme: 'grid', styles: { font: "Kalpurush", fontStyle: 'normal', halign: 'center' }, headStyles: { fillColor: [16, 185, 129] } });
                doc.save(`AutoBook-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
                Swal.close();
            } catch (error) {
                console.error("PDF generation error:", error);
                Swal.fire({ icon: 'error', title: 'PDF তৈরিতে সমস্যা', text: 'একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
            }
        },
        
                // --- Installment Methods ---
        showInstallment: () => {
                showSection('installment');
                // Ensure the first tab is active when shown
                document.querySelector('.tab-link').click();
            },
            openInstallmentTab: (event, tabName) => {
                const tabcontent = document.getElementsByClassName("tab-content");
                for (let i = 0; i < tabcontent.length; i++) {
                    tabcontent[i].style.display = "none";
                }
                const tablinks = document.getElementsByClassName("tab-link");
                for (let i = 0; i < tablinks.length; i++) {
                    tablinks[i].className = tablinks[i].className.replace(" active", "");
                }
                document.getElementById(tabName).style.display = "block";
                event.currentTarget.className += " active";
            },
             
                     showInstallmentPlanForm: (isEditing = false) => {
            if (installmentPlanForm) {
                const formTitle = installmentPlanForm.querySelector('h3');
                const autoSelect = document.getElementById('installmentAutoSelect');
                
                if (isEditing) {
                    formTitle.textContent = 'প্ল্যান এডিট করুন';
                    autoSelect.disabled = true; // গাড়ি পরিবর্তন করতে দেওয়া হবে না
                } else {
                    editingPlanId = null; // নতুন প্ল্যানের জন্য আইডি রিসেট করা
                    formTitle.textContent = 'নতুন কিস্তির প্ল্যান';
                    autoSelect.disabled = false;
                    
                    // Clear form fields for new entry
                    autoSelect.value = '';
                    document.getElementById('totalPriceInput').value = '';
                    document.getElementById('downPaymentInput').value = '';
                    document.getElementById('totalInstallmentsInput').value = '';
                    document.getElementById('firstInstallmentDateInput').valueAsDate = new Date();
                    
                    const displayElement = document.getElementById('calculatedAmount');
                    if (displayElement) displayElement.style.display = 'none';
                }
                
                installmentPlanForm.classList.add('show');
                mainContent.style.filter = 'blur(4px)';
                document.getElementById('installmentSection').style.filter = 'blur(4px)';
            }
        }, hideInstallmentPlanForm: () => {
                if (installmentPlanForm) {
                    installmentPlanForm.classList.remove('show');
                    mainContent.style.filter = 'none';
                    document.getElementById('installmentSection').style.filter = 'none';
                }
            },
          
          
                    saveInstallmentPlan: async () => {
            if (!currentUser) return;
            
            const planData = {
                totalPrice: parseFloat(document.getElementById('totalPriceInput').value) || 0,
                downPayment: parseFloat(document.getElementById('downPaymentInput').value) || 0,
                totalInstallments: parseInt(document.getElementById('totalInstallmentsInput').value) || 0,
                firstInstallmentDate: document.getElementById('firstInstallmentDateInput').value,
            };
            
            if (planData.totalPrice <= 0 || planData.totalInstallments <= 0 || !planData.firstInstallmentDate) {
                return Swal.fire({ icon: 'error', title: 'ফর্ম পূরণ করুন', text: 'অনুগ্রহ করে সব তথ্য সঠিকভাবে দিন।' });
            }
            const totalDue = planData.totalPrice - planData.downPayment;
            if (totalDue < 0) {
                return Swal.fire({ icon: 'error', title: 'ভুল তথ্য', text: 'ডাউন পেমেন্ট মোট মূল্যের চেয়ে বেশি হতে পারে না।' });
            }
            const installmentAmount = parseFloat((totalDue / planData.totalInstallments).toFixed(2));
            
            // যদি এডিট করা হয়
            if (editingPlanId) {
                const planToUpdate = installmentPlans.find(p => p.id === editingPlanId);
                // যদি পেমেন্ট সংখ্যা নতুন কিস্তির সংখ্যার চেয়ে বেশি হয়ে যায়, তাহলে এডিট করতে বাধা দেওয়া
                if (planToUpdate.payments && planToUpdate.payments.length > planData.totalInstallments) {
                    return Swal.fire({ icon: 'error', title: 'এডিট সম্ভব নয়', text: `আপনি ইতিমধ্যে ${planToUpdate.payments.length} টি কিস্তি পরিশোধ করেছেন, তাই মোট কিস্তির সংখ্যা এর চেয়ে কম হতে পারে না।` });
                }
                
                const updatedPlan = {
                    totalPrice: planData.totalPrice,
                    downPayment: planData.downPayment,
                    firstInstallmentDate: planData.firstInstallmentDate,
                    totalDue: totalDue,
                    installmentAmount: installmentAmount,
                };
                
                try {
                    await db.collection("installmentPlans").doc(editingPlanId).update(updatedPlan);
                    Swal.fire({ icon: 'success', title: 'সফল', text: 'প্ল্যানটি সফলভাবে আপডেট হয়েছে।' });
                } catch (error) {
                    console.error("Error updating plan:", error);
                    Swal.fire({ icon: 'error', title: 'ব্যর্থ', text: 'প্ল্যান আপডেট করতে সমস্যা হয়েছে।' });
                }
                
            } else { // যদি নতুন প্ল্যান তৈরি করা হয়
                const autoName = document.getElementById('installmentAutoSelect').value;
                if (!autoName) return Swal.fire({ icon: 'error', title: 'গাড়ি নির্বাচন করুন', text: 'একটি গাড়ি নির্বাচন করতে হবে।' });
                
                const newPlan = {
                    autoName: autoName,
                    ...planData,
                    installmentAmount: installmentAmount,
                    totalDue: totalDue,
                    userId: currentUser.uid,
                    payments: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                delete newPlan.totalInstallments;
                
                try {
                    await db.collection("installmentPlans").add(newPlan);
                    Swal.fire({ icon: 'success', title: 'সফল', text: 'নতুন কিস্তির প্ল্যান সেভ হয়েছে।' });
                } catch (error) {
                    console.error("Error saving plan:", error);
                    Swal.fire({ icon: 'error', title: 'ব্যর্থ', text: 'প্ল্যান সেভ করতে সমস্যা হয়েছে।' });
                }
            }
            
            window.app.hideInstallmentPlanForm();
            editingPlanId = null; // রিসেট
        },
                
                
                
                deleteInstallmentPlan: (planId) => {
                    Swal.fire({
                        title: 'আপনি কি নিশ্চিত?',
                        text: "এই প্ল্যানটি মুছে ফেললে এর সাথে সম্পর্কিত সব পেমেন্ট হিস্ট্রিও মুছে যাবে!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'হ্যাঁ, মুছে ফেলুন!',
                        cancelButtonText: 'না'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            try {
                                await db.collection("installmentPlans").doc(planId).delete();
                                Swal.fire('মুছে ফেলা হয়েছে!', 'প্ল্যানটি সফলভাবে মুছে ফেলা হয়েছে।', 'success');
                            } catch (e) {
                                Swal.fire('ব্যর্থ!', 'প্ল্যানটি মুছতে সমস্যা হয়েছে।', 'error');
                            }
                        }
                    });
                },
                
                   editInstallmentPlan: (planId) => {
            editingPlanId = planId;
            const plan = installmentPlans.find(p => p.id === planId);
            if (!plan) return;
            
            // Load plan data into the form
            document.getElementById('installmentAutoSelect').value = plan.autoName;
            document.getElementById('totalPriceInput').value = plan.totalPrice;
            document.getElementById('downPaymentInput').value = plan.downPayment;
            document.getElementById('firstInstallmentDateInput').value = plan.firstInstallmentDate;
            
            // Calculate and set total installments
            const totalInstallments = Math.round(plan.totalDue / plan.installmentAmount);
            document.getElementById('totalInstallmentsInput').value = totalInstallments;
            
            // Show the form in editing mode
            window.app.showInstallmentPlanForm(true);
            
            // Trigger calculation display manually
            const calculateInstallment = document.getElementById('totalPriceInput')._calculate;
            if (calculateInstallment) calculateInstallment();
            
        },     
                
                
                    payInstallment: async (planId, event) => {
            const payButton = event.target;
            if (payButton.disabled) return;
            
            payButton.disabled = true;
            payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            if (!currentUser) {
                payButton.disabled = false;
                payButton.innerHTML = 'কিস্তি পরিশোধ করুন';
                return;
            }
            const plan = installmentPlans.find(p => p.id === planId);
            if (!plan) {
                payButton.disabled = false;
                payButton.innerHTML = 'কিস্তি পরিশোধ করুন';
                return;
            }
            
            try {
                const result = await Swal.fire({
                    title: 'কিস্তি পরিশোধ',
                    text: `${plan.autoName}-এর জন্য ${plan.installmentAmount.toLocaleString('bn-BD')} টাকার কিস্তি পরিশোধ করতে চান?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'হ্যাঁ, পরিশোধ করুন',
                    cancelButtonText: 'না'
                });
                
                if (result.isConfirmed) {
                    payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> প্রসেসিং...';
                    
                    const paymentRecord = {
                        date: new Date().toISOString().slice(0, 10),
                        amount: plan.installmentAmount,
                        paidAt: new Date().toISOString()
                    };
                    
                    // Firestore ডকুমেন্ট আপডেট করা
                    await db.collection("installmentPlans").doc(planId).update({
                        payments: firebase.firestore.FieldValue.arrayUnion(paymentRecord)
                    });
                    
                    // Firestore থেকে ডেটা আপডেট হওয়ার জন্য onSnapshot লিসেনারকে সময় দেওয়া
                    // এবং UI আপডেট হওয়া পর্যন্ত অপেক্ষা করা।
                    // যেহেতু onSnapshot কাজ করছে, আমাদের ম্যানুয়ালি কিছু করার দরকার নেই।
                    // শুধু একটি ছোট ডিলে যোগ করা যেতে পারে UI-তে পরিবর্তনটি দেখার জন্য।
                    
                    playSound('submit');
                    await Swal.fire('সফল!', 'কিস্তি সফলভাবে পরিশোধ করা হয়েছে।', 'success');
                    
                }
            } catch (error) {
                console.error("Payment Error:", error);
                await Swal.fire('ব্যর্থ!', 'একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
            } finally {
                // সব কাজ শেষে বাটন আবার সক্রিয় করা
                payButton.disabled = false;
                payButton.innerHTML = 'কিস্তি পরিশোধ করুন';
            }
        },
            
            
                showPaymentHistory: (planId) => {
                    const plan = installmentPlans.find(p => p.id === planId);
                    if (!plan || !plan.payments || plan.payments.length === 0) {
                        return Swal.fire('ইতিহাস নেই', 'এখনো কোনো কিস্তি পরিশোধ করা হয়নি।', 'info');
                    }
                    
                    const historyHtml = `<div style="text-align: left; max-height: 300px; overflow-y: auto;">
                <ul style="list-style-type: none; padding: 0;">
                    ${plan.payments.sort((a,b) => new Date(b.date) - new Date(a.date)).map((p, index) => `
                        <li style="padding: 8px; border-bottom: 1px solid #eee;">
                           <strong>${plan.payments.length - index}.</strong> পরিশোধের তারিখ: ${new Date(p.date).toLocaleDateString('bn-BD')}
                           <br>
                           <small>টাকার পরিমাণ: ${p.amount.toLocaleString('bn-BD')} ৳</small>
                        </li>
                    `).join('')}
                </ul>
            </div>`;
                    
                    Swal.fire({
                        title: `${plan.autoName}-এর পেমেন্ট ইতিহাস`,
                        html: historyHtml,
                        confirmButtonText: 'ঠিক আছে'
                    });
                }
        
    };

    // --- Firebase Listeners & Auth Management ---
    
        const listenForAutos = (userId) => {
        db.collection("users").doc(userId).collection("autos").orderBy("createdAt", "asc")
            .onSnapshot(snapshot => {
                autos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderAutos();
            }, error => console.error("Error fetching autos:", error));
    };
    
    const listenForEntries = (userId) => {
        db.collection("entries").where("userId", "==", userId).orderBy("createdAt", "desc")
            .onSnapshot(snapshot => {
                entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderEntries();
                updateCashDisplays();
                updateTodaySummary();
            }, error => console.error("Error fetching entries:", error));
    };
    
    
        const listenForInstallmentPlans = (userId) => {
        db.collection("installmentPlans").where("userId", "==", userId).orderBy("createdAt", "asc")
            .onSnapshot(snapshot => {
                installmentPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderInstallmentPlans();
                renderAutos(); // Re-render autos to update dropdowns
                updateInstallmentReminder();
            }, error => console.error("Error fetching installment plans:", error));
    };

    const listenForMessages = (userId) => {
        db.collection("messages").where("userId", "==", userId).orderBy("time", "desc")
            .onSnapshot(snapshot => {
                messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateUnreadBadge();
                if(window.app.renderMessages) window.app.renderMessages();
            }, error => console.error("Error fetching messages:", error));
    };

    const initializeAppForUser = (user) => {
        if (user) {
            // DOM elements must be initialized first
            splash = document.getElementById('splash');
            sideMenu = document.getElementById('sideMenu');
            mainContent = document.getElementById('mainContent');
            entryForm = document.getElementById('entryForm');
            entriesDiv = document.getElementById('entries');
            cashLabel = document.getElementById('cashLabel');
            todaySummary = document.getElementById('todaySummary');
            unreadCount = document.getElementById('unreadCount');
            darkModeToggle = document.getElementById('darkModeToggle');
            reportContent = document.getElementById('reportContent');
            messagesList = document.getElementById('messagesList');
            
                        autoListDiv = document.getElementById('autoList');
            reportAutoFilter = document.getElementById('autoFilter');
            sections.main = mainContent;
            sections.messages = document.getElementById('messagesSection');
            sections.report = document.getElementById('reportSection');
            sections.settings = document.getElementById('settingsSection');
            sections.about = document.getElementById('aboutSection');
                        sections.installment = document.getElementById('installmentSection');
            installmentPlanForm = document.getElementById('installmentPlanForm');

                         const userDocRef = db.collection('users').doc(user.uid);
            userDocRef.get().then(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            // একটি নির্দিষ্ট এবং নির্ভরযোগ্য currentUser অবজেক্ট তৈরি করা
                            currentUser = {
                                uid: user.uid,
                                email: user.email,
                                displayName: userData.name, // Firestore থেকে নাম ব্যবহার করা
                                username: userData.username // Firestore থেকে ইউজারনেম ব্যবহার করা
                            };
                        } else {
                            // নতুন ব্যবহারকারীর জন্য তথ্য তৈরি করা
                            const defaultUsername = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'unknown_user';
                            const newName = user.displayName || defaultUsername;
                            
                            currentUser = {
                                uid: user.uid,
                                email: user.email,
                                displayName: newName,
                                username: defaultUsername
                            };
                            // নতুন ব্যবহারকারীর তথ্য Firestore এ সেভ করা
                            db.collection('users').doc(user.uid).set({
                                name: newName,
                                username: defaultUsername,
                                email: user.email,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                initial: newName.charAt(0).toUpperCase()
                            }).catch(e => console.error("Error saving new user data:", e));
                        }
                
                
                document.body.style.display = 'block';
                if (splash) splash.style.display = 'none';
                if (darkMode) document.body.classList.add('dark');
                if (darkModeToggle) { darkModeToggle.classList.toggle('fa-sun', darkMode); darkModeToggle.classList.toggle('fa-moon', !darkMode); }
                listenForEntries(currentUser.uid);
                listenForMessages(currentUser.uid);
                listenForAutos(currentUser.uid);
                listenForInstallmentPlans(currentUser.uid);
            }).catch(error => {
                console.error("Error fetching user data from Firestore:", error);
                document.body.style.display = 'block';
                if (splash) splash.style.display = 'none';
            });
        } else {
            currentUser = null;
            if (!window.location.pathname.includes('login.html')) window.location.href = 'login.html';
        }
        
                // Event listener for income/expense radio buttons
            const typeRadios = document.querySelectorAll('input[name="type"]');
            const descriptionInput = document.getElementById('descriptionInput');
            if (typeRadios && descriptionInput) {
                typeRadios.forEach(radio => {
                    radio.addEventListener('change', (event) => {
                        if (event.target.value === 'income') {
                            if (descriptionInput.value === '') {
                                descriptionInput.value = 'জমা';
                            }
                        } else if (event.target.value === 'expense') {
                            if (descriptionInput.value === 'জমা') {
                                descriptionInput.value = '';
                            }
                        }
                    });
                });
            }
    
    
                // --- Auto-calculate installment amount ---
            const calculateInstallment = () => {
                const totalPrice = parseFloat(document.getElementById('totalPriceInput').value) || 0;
                const downPayment = parseFloat(document.getElementById('downPaymentInput').value) || 0;
                const totalInstallments = parseInt(document.getElementById('totalInstallmentsInput').value) || 0;
                const displayElement = document.getElementById('calculatedAmount');
                
                if (totalPrice > 0 && totalInstallments > 0) {
                    const totalDue = totalPrice - downPayment;
                    if (totalDue >= 0) {
                        const amount = totalDue / totalInstallments;
                        displayElement.textContent = `প্রতি কিস্তির পরিমাণ হবে প্রায় ${amount.toLocaleString('bn-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ৳`;
                        displayElement.style.display = 'block';
                    } else {
                        displayElement.style.display = 'none';
                    }
                } else {
                    displayElement.style.display = 'none';
                }
            };
            
            document.getElementById('totalPriceInput').addEventListener('input', calculateInstallment);
            document.getElementById('downPaymentInput').addEventListener('input', calculateInstallment);
                         // Attach the function to the element so we can call it manually
            const totalPriceInput = document.getElementById('totalPriceInput');
            const downPaymentInput = document.getElementById('downPaymentInput');
            const totalInstallmentsInput = document.getElementById('totalInstallmentsInput');
            
            totalPriceInput.addEventListener('input', calculateInstallment);
            totalPriceInput._calculate = calculateInstallment; // Attach for manual call
            downPaymentInput.addEventListener('input', calculateInstallment);
            totalInstallmentsInput.addEventListener('input', calculateInstallment);
    
    };

    // --- App Initialization ---
    document.body.style.display = 'none';
    auth.onAuthStateChanged(initializeAppForUser);
})();