// আপনার ওয়েব অ্যাপের Firebase কনফিগারেশন
const firebaseConfig = {
  apiKey: "AIzaSyD_IkGO-INZZqU4BNuPwMEaHHv033yZe_c",
  authDomain: "auto-book-new.firebaseapp.com",
  projectId: "auto-book-new",
  storageBucket: "auto-book-new.firebasestorage.app",
  messagingSenderId: "104184882242",
  appId: "1:104184882242:web:57194b9977021385e339db"
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- DOM Elements ---
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const forgotPasswordLink = document.getElementById('forgot-password-link');

const signupNameInput = document.getElementById('signup-name');
const signupUsernameInput = document.getElementById('signup-username');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');

// --- Custom SweetAlert2 Functions ---
const showLoading = (title, text = 'অনুগ্রহ করে অপেক্ষা করুন...') => {
  Swal.fire({
    title: title,
    text: text,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
};

const showSuccessToast = (title) => {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: title,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
};

// --- Form Toggling Logic ---
if (showSignupLink) {
  showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.classList.add('hidden');
    signupFormContainer.classList.remove('hidden');
  });
}
if (showLoginLink) {
  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupFormContainer.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
  });
}

// --- Signup Logic ---
if (signupBtn) {
  signupBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = signupNameInput.value.trim();
    const username = signupUsernameInput.value.trim().toLowerCase();
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    
    if (!name || !username || !email || !password) {
      return Swal.fire({ icon: 'error', title: 'ফর্ম পূরণ করুন', text: 'অনুগ্রহ করে সব তথ্য পূরণ করুন।' });
    }
    if (password.length < 6) {
      return Swal.fire({ icon: 'error', title: 'দুর্বল পাসওয়ার্ড', text: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
    }
    
    showLoading('অ্যাকাউন্ট তৈরি হচ্ছে...');
    
    try {
      const usernameQuery = await db.collection('users').where('username', '==', username).get();
      if (!usernameQuery.empty) {
        return Swal.fire({ icon: 'error', title: 'ইউজারনেম ব্যবহৃত', text: 'এই ইউজারনেমটি অন্য কেউ ব্যবহার করছে। অনুগ্রহ করে অন্য একটি চেষ্টা করুন।' });
      }
      
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      await user.updateProfile({ displayName: name });
      
      await db.collection('users').doc(user.uid).set({
        name: name,
        username: username,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        initial: name.charAt(0).toUpperCase()
      });
      
      await user.sendEmailVerification();
      
      Swal.fire({
        icon: 'success',
        title: 'সফল!',
        html: 'আপনার অ্যাকাউন্ট তৈরি হয়েছে। <br>আপনার ইমেইলে একটি ভেরিফিকেশন লিঙ্ক পাঠানো হয়েছে। অনুগ্রহ করে ইমেইল ভেরিফাই করে লগইন করুন।',
        customClass: { popup: 'animated-gradient-bg' } // আপনার বানানো সুন্দর ক্লাস
      }).then(() => {
        signupFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
      });
      
    } catch (error) {
      console.error("Signup Error:", error.code, error.message);
      let title = 'সাইন আপ ব্যর্থ';
      let text = 'একটি অজানা সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
      if (error.code === 'auth/email-already-in-use') {
        text = 'এই ইমেইলটি দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা আছে।';
      } else if (error.code === 'auth/invalid-email') {
        text = 'অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা দিন।';
      }
      Swal.fire({ icon: 'error', title: title, text: text });
    }
  });
}


// --- Login Logic ---
if (loginBtn) {
  loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    if (!email || !password) {
      return Swal.fire({ icon: 'warning', title: 'তথ্য দিন', text: 'অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিন।' });
    }
    
    showLoading('লগইন করা হচ্ছে...');
    
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // emailVerified কিনা তা onAuthStateChanged হ্যান্ডেল করবে, এখানে শুধু লগইন সফল হয়েছে তা নিশ্চিত করা হলো
      // সফল লগইনের পর onAuthStateChanged ফায়ার হবে এবং পরবর্তী কাজ করবে
      // তাই এখানে Swal.close() করা অপ্রয়োজনীয়, কারণ redirect হবে
      
    } catch (error) {
      console.error("Login Error:", error);
      let text = 'আপনার দেওয়া ইমেইল বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।';
      Swal.fire({ icon: 'error', title: 'লগইন ব্যর্থ', text: text });
    }
  });
}

// --- Google Login Logic ---
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', () => {
    showLoading('Google এর সাথে সংযোগ করা হচ্ছে...');
    auth.signInWithPopup(googleProvider)
      .then(result => {
        const user = result.user;
        const userRef = db.collection('users').doc(user.uid);
        
        // Check if user already exists in Firestore
        return userRef.get().then(doc => {
          if (!doc.exists) {
            // If not, create a new user document
            const newUsername = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 100);
            return userRef.set({
              name: user.displayName,
              username: newUsername,
              email: user.email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              initial: user.displayName.charAt(0).toUpperCase()
            });
          }
          // User already exists, no action needed. onAuthStateChanged will redirect.
        });
      }).catch(error => {
        console.error("Google Login Error:", error);
        Swal.fire({ icon: 'error', title: 'Google লগইন ব্যর্থ', text: error.message });
      });
  });
}


// --- Forgot Password Logic ---
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const { value: email } = await Swal.fire({
      title: 'পাসওয়ার্ড রিসেট',
      input: 'email',
      inputLabel: 'আপনার অ্যাকাউন্টের ইমেইল ঠিকানা দিন',
      inputPlaceholder: 'email@example.com',
      showCancelButton: true,
      confirmButtonText: 'রিসেট লিঙ্ক পাঠান',
      cancelButtonText: 'বাতিল'
    });
    
    if (email) {
      showLoading('লিঙ্ক পাঠানো হচ্ছে...');
      try {
        await auth.sendPasswordResetEmail(email);
        Swal.fire({
          icon: 'success',
          title: 'ইমেইল পাঠানো হয়েছে',
          text: `"${email}"-এ একটি পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে।`
        });
      } catch (error) {
        console.error("Password Reset Error:", error);
        Swal.fire({
          icon: 'error',
          title: 'ত্রুটি',
          text: 'একটি সমস্যা হয়েছে। ইমেইলটি সঠিক কিনা তা পরীক্ষা করুন।'
        });
      }
    }
  });
}

// --- Auth State Observer (The most important part) ---
auth.onAuthStateChanged(user => {
  const onLoginPage = window.location.pathname.includes('login.html');
  
  if (user) {
    if (user.emailVerified) {
      // User is logged in and verified
      Swal.close(); // Close any open 'loading' alerts
      if (onLoginPage) {
        window.location.href = 'index.html';
      }
    } else {
      // User is logged in but NOT verified
      Swal.close(); // Close any open 'loading' alerts
      if (onLoginPage) {
        // Stay on the login page and show verification message
        Swal.fire({
          icon: 'warning',
          title: 'ইমেইল ভেরিফাই করুন',
          html: `আপনার ইমেইল (${user.email}) ভেরিফাই করা হয়নি। অনুগ্রহ করে আপনার ইনবক্স চেক করুন। <br><br> লিঙ্ক পাননি?`,
          showCancelButton: true,
          confirmButtonText: 'লিঙ্ক আবার পাঠান',
          cancelButtonText: 'ঠিক আছে',
          footer: 'ভেরিফাই করার পর পৃষ্ঠাটি রিলোড করুন।'
        }).then((result) => {
          if (result.isConfirmed) {
            // User clicked 'Resend Link'
            user.sendEmailVerification()
              .then(() => showSuccessToast('ভেরিফিকেশন ইমেইল আবার পাঠানো হয়েছে!'))
              .catch(err => Swal.fire('ব্যর্থ!', err.message, 'error'));
          }
          // In any case, log them out so they have to log in again after verifying
          auth.signOut();
        });
      } else {
        // If they are on any other page, log them out and redirect to login
        auth.signOut();
      }
    }
  } else {
    // User is not logged in
    if (!onLoginPage) {
      window.location.href = 'login.html';
    }
  }
});


// --- Password Toggle Visibility Logic ---
document.querySelectorAll('.toggle-password').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const passwordInput = toggle.previousElementSibling;
    const icon = toggle.querySelector('i');
    if (passwordInput && icon) {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-lock');
        icon.classList.add('fa-unlock-alt');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-unlock-alt');
        icon.classList.add('fa-lock');
      }
    }
  });
});