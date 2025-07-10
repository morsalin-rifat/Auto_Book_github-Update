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
    let showCash = false;
    let darkMode = localStorage.getItem('darkMode') === 'true';

    // --- DOM Elements (will be initialized later) ---
     let splash, sideMenu, mainContent, entryForm, entriesDiv, cashLabel, todaySummary, unreadCount, darkModeToggle, reportContent, messagesList, autoListDiv, reportAutoFilter;
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
        Object.values(sections).forEach(section => section.classList.add('hidden'));
        if (sections[sectionName]) {
            sections[sectionName].classList.remove('hidden');
            mainContent.style.display = (sectionName === 'main') ? 'block' : 'none';
        }
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

            const userDocRef = db.collection('users').doc(user.uid);
            userDocRef.get().then(doc => {
                if (doc.exists) {
                    currentUser = { uid: user.uid, email: user.email, ...doc.data() };
                } else {
                    const defaultUsername = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'unknown_user';
                    currentUser = { uid: user.uid, email: user.email, displayName: user.displayName || defaultUsername, username: defaultUsername };
                    db.collection('users').doc(user.uid).set({ name: currentUser.displayName, username: currentUser.username, email: currentUser.email, createdAt: firebase.firestore.FieldValue.serverTimestamp(), initial: currentUser.displayName.charAt(0).toUpperCase() }).catch(e => console.error("Error saving new user data:", e));
                }
                document.body.style.display = 'block';
                if (splash) splash.style.display = 'none';
                if (darkMode) document.body.classList.add('dark');
                if (darkModeToggle) { darkModeToggle.classList.toggle('fa-sun', darkMode); darkModeToggle.classList.toggle('fa-moon', !darkMode); }
                listenForEntries(currentUser.uid);
                listenForMessages(currentUser.uid);
                listenForAutos(currentUser.uid);
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
    
    };

    // --- App Initialization ---
    document.body.style.display = 'none';
    auth.onAuthStateChanged(initializeAppForUser);
})();