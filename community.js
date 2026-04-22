// community.js - Handles Firebase REST API logic via jQuery with Real-time & Rich Features

const DB_URL = "https://caregiver-c85e3-default-rtdb.europe-west1.firebasedatabase.app";

$(document).ready(function () {

    // --- STATE ---
    let currentUser = JSON.parse(localStorage.getItem("communityUser") || "null");
    let currentPostsHash = "";
    let globalPostsData = {};
    let pendingPostAction = false;

    // --- VANILLA MODAL LOGIC ---
    window.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    };

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // Only remove modal-open if no other modals are open
            if (document.querySelectorAll('.custom-modal-overlay.show').length === 0) {
                document.body.classList.remove('modal-open');
            }
        }
    };

    // Close on click outside
    $(document).on('click', '.custom-modal-overlay', function(e) {
        if (e.target === this) {
            closeModal(this.id);
        }
    });

    // Close on Esc key
    $(document).on('keydown', function(e) {
        if (e.key === "Escape") {
            const openModal = document.querySelector('.custom-modal-overlay.show');
            if (openModal) closeModal(openModal.id);
        }
    });

    // --- TRANSLATION HELPER ---
    function getT() {
        const lang = localStorage.getItem('selectedLang') || 'en';
        return translations[lang] || translations['en'];
    }

    function updateAuthUI() {
        const t = getT();
        if (currentUser) {
            $("#auth-buttons").hide();
            $("#display-user-name").text(currentUser.name);
            $("#sidebar-user-name").text(currentUser.name);
            $("#sidebar-auth-block").addClass("hidden");
            $("#sidebar-stats-block, #sidebar-logout-link").removeClass("hidden");
            let initial = currentUser.name.charAt(0).toUpperCase();
            $("#sidebar-avatar, #creator-avatar").text(initial);
            $(".post-creator-input").text(t.comm_whats_on_mind || "What's on your mind?");
            fetchNotifs();
        } else {
            $("#auth-buttons").show();
            $("#user-actions").hide();
            $("#notif-badge").hide();
            $("#sidebar-user-name").text("Guest");
            $("#sidebar-avatar, #creator-avatar").text("?");
            $("#sidebar-auth-block").removeClass("hidden");
            $("#sidebar-stats-block, #sidebar-logout-link").addClass("hidden");
            $(".post-creator-input").text(t.comm_must_login || "Sign in to post...");
        }
    }

    // Initialize UI
    updateAuthUI();

    // --- REGISTRATION LOGIC ---
    $("#register-form").submit(function (e) {
        e.preventDefault();
        const t = getT();
        let name = $("#reg-name").val().trim();
        let email = $("#reg-email").val().trim();
        let password = $("#reg-password").val();
        let $btn = $("#reg-submit-btn").prop("disabled", true).text("...");

        let newUser = { name: name, email: email, password: password };
        $.ajax({
            url: `${DB_URL}/users.json`,
            type: 'POST',
            data: JSON.stringify(newUser),
            success: function (res) {
                currentUser = { id: res.name, name: name, email: email };
                localStorage.setItem("communityUser", JSON.stringify(currentUser));
                updateAuthUI();
                closeModal('registerModal');
                $("#register-form")[0].reset();
                $btn.prop("disabled", false).text(t.nav_signup || "Sign Up");
            },
            error: function () {
                $("#reg-error").removeClass("hidden");
                $btn.prop("disabled", false).text(t.nav_signup || "Sign Up");
            }
        });
    });

    // --- LOGIN LOGIC ---
    $("#login-form").submit(function (e) {
        e.preventDefault();
        const t = getT();
        let email = $("#login-email").val().trim();
        let password = $("#login-password").val();
        let $btn = $("#login-submit-btn").prop("disabled", true).text("...");
        $("#login-error").addClass("hidden");

        $.ajax({
            url: `${DB_URL}/users.json`,
            type: 'GET',
            success: function (data) {
                let userFound = false;
                if (data) {
                    for (let key in data) {
                        let u = data[key];
                        if (u.email === email && u.password === password) {
                            currentUser = { id: key, name: u.name, email: u.email };
                            localStorage.setItem("communityUser", JSON.stringify(currentUser));
                            updateAuthUI();
                            closeModal('loginModal');
                            $("#login-form")[0].reset();
                            if (pendingPostAction) {
                                openModal('askModal');
                                pendingPostAction = false;
                            }
                            userFound = true;
                            break;
                        }
                    }
                }
                if (!userFound) $("#login-error").removeClass("hidden");
                $btn.prop("disabled", false).text(t.nav_login || "Login");
            },
            error: function () {
                $("#login-error").text("Error").removeClass("hidden");
                $btn.prop("disabled", false).text(t.nav_login || "Login");
            }
        });
    });

    // --- LOGOUT LOGIC ---
    $("#logout-btn, #logout-btn-sidebar").click(function () {
        currentUser = null;
        localStorage.removeItem("communityUser");
        updateAuthUI();
    });

    // --- POST TRIGGER LOGIC ---
    $("#whats-on-your-mind-btn").click(function() {
        if (currentUser) {
            openModal('askModal');
        } else {
            pendingPostAction = true;
            openModal('loginModal');
        }
    });

    // --- SUBMIT QUESTION LOGIC ---
    $("#ask-form").submit(function (e) {
        e.preventDefault();
        const t = getT();
        if (!currentUser) return alert(t.comm_must_login);

        let title = $("#post-title").val().trim();
        let content = $("#post-content").val().trim();
        let $btn = $("#post-submit-btn").prop("disabled", true).text("...");

        let newPost = {
            title: title,
            content: content,
            authorId: currentUser.id,
            authorName: currentUser.name,
            timestamp: Date.now()
        };

        $.ajax({
            url: `${DB_URL}/posts.json`,
            type: 'POST',
            data: JSON.stringify(newPost),
            success: function (res) {
                closeModal('askModal');
                $("#ask-form")[0].reset();
                $btn.prop("disabled", false).text(t.comm_send);
                fetchPosts();
            },
            error: function () {
                alert("Error");
                $btn.prop("disabled", false).text(t.comm_send);
            }
        });
    });

    // --- REAL-TIME POLLING: POSTS ---
    function fetchPosts() {
        $.ajax({
            url: `${DB_URL}/posts.json`,
            type: 'GET',
            success: function (data) {
                let hash = JSON.stringify(data || {});
                if (hash !== currentPostsHash) {
                    currentPostsHash = hash;
                    globalPostsData = data || {};
                    processPosts(data);

                    let openPostId = $("#postDetailModal").attr("data-current-post");
                    if (openPostId && $("#postDetailModal").hasClass("show")) {
                        renderPostModal(openPostId);
                    }
                }
            }
        });
    }

    setInterval(fetchPosts, 3000);

    // --- REAL-TIME POLLING: NOTIFICATIONS ---
    function fetchNotifs() {
        if (!currentUser) return;
        const t = getT();
        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/notifications.json`,
            type: 'GET',
            success: function (data) {
                let list = $("#notif-list");
                list.empty();
                let unreadCount = 0;
                let notifsArray = [];

                if (data) {
                    for (let key in data) {
                        notifsArray.push({ id: key, ...data[key] });
                    }
                }

                if (notifsArray.length === 0) {
                    list.html(`<li class="text-center text-gray-400 text-sm py-6 italic">${t.comm_no_notifs}</li>`);
                    $("#notif-badge").addClass("hidden");
                    return;
                }

                notifsArray.sort((a, b) => b.timestamp - a.timestamp);

                notifsArray.forEach(n => {
                    if (!n.read) unreadCount++;
                    let timeStr = timeSince(n.timestamp);
                    let bgClass = n.read ? "bg-white" : "bg-primary/5";
                    list.append(`
                        <li class="border-b border-gray-50 last:border-0">
                           <a class="block p-4 ${bgClass} hover:bg-gray-50 transition-all notif-item" href="#" data-id="${n.id}" data-post-id="${n.postId}">
                             <p class="text-sm text-gray-800"><strong class="text-primary">${$("<div>").text(n.actorName).html()}</strong> ${t.comm_replied_to}</p>
                             <small class="text-gray-400 text-[10px] uppercase font-black mt-1 block">${timeStr}</small>
                           </a>
                        </li>
                    `);
                });

                if (unreadCount > 0) {
                    $("#notif-badge").text(unreadCount).removeClass("hidden");
                } else {
                    $("#notif-badge").addClass("hidden");
                }
            }
        });
    }

    setInterval(fetchNotifs, 5000);

    $(document).on("click", ".notif-item", function (e) {
        e.preventDefault();
        let notifId = $(this).data("id");
        let postId = $(this).data("post-id");

        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/notifications/${notifId}.json`,
            type: 'PATCH',
            data: JSON.stringify({ read: true }),
            success: function () {
                fetchNotifs();
            }
        });

        openPostModal(postId);
    });

    // --- REPLIES LOGIC ---
    $(document).on("submit", ".reply-form", function (e) {
        e.preventDefault();
        if (!currentUser) return;

        let $form = $(this);
        let postId = $form.data("post-id");
        let content = $form.find("input").val().trim();
        let $btn = $form.find("button").prop("disabled", true);

        let newReply = {
            authorId: currentUser.id,
            authorName: currentUser.name,
            content: content,
            timestamp: Date.now()
        };

        $.ajax({
            url: `${DB_URL}/posts/${postId}/answers.json`,
            type: 'POST',
            data: JSON.stringify(newReply),
            success: function () {
                if (globalPostsData[postId] && globalPostsData[postId].authorId !== currentUser.id) {
                    let postOwnerId = globalPostsData[postId].authorId;
                    let notif = {
                        postId: postId,
                        actorName: currentUser.name,
                        type: 'reply',
                        read: false,
                        timestamp: Date.now()
                    };
                    $.ajax({
                        url: `${DB_URL}/users/${postOwnerId}/notifications.json`,
                        type: 'POST',
                        data: JSON.stringify(notif)
                    });
                }

                $form.find("input").val("");
                $btn.prop("disabled", false);
                fetchPosts();
            },
            error: function () {
                alert("Error");
                $btn.prop("disabled", false);
            }
        });
    });

    // --- FB REACTIONS LOGIC ---
    $(document).on("click", ".reaction-btn", function () {
        const t = getT();
        if (!currentUser) return alert(t.comm_must_login);
        let container = $(this).closest(".reaction-container");
        let postId = container.data("post-id");
        let answerId = container.data("answer-id");
        let reactionType = $(this).data("type");

        let url = answerId
            ? `${DB_URL}/posts/${postId}/answers/${answerId}/reactions/${currentUser.id}.json`
            : `${DB_URL}/posts/${postId}/reactions/${currentUser.id}.json`;

        $.ajax({
            url: url,
            type: 'PUT',
            data: JSON.stringify(reactionType),
            success: function () { fetchPosts(); }
        });
    });

    // --- RENDERING ---
    function processPosts(data) {
        let postsArray = [];
        if (data) {
            for (let key in data) {
                postsArray.push({ id: key, ...data[key] });
            }
        }
        postsArray.sort((a, b) => b.timestamp - a.timestamp);
        renderFeed(postsArray);
    }

    function timeSince(date) {
        const t = getT();
        let seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + t.comm_y_ago;
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + t.comm_mo_ago;
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + t.comm_d_ago;
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + t.comm_h_ago;
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + t.comm_m_ago;
        return t.comm_just_now;
    }

    function buildReactionsHtml(postId, item, answerId = null) {
        let rxns = item.reactions || {};
        let summary = { '👍': 0, '❤️': 0, '😂': 0, '😮': 0, '😢': 0, '😡': 0 };
        let total = 0;
        for (let uid in rxns) {
            summary[rxns[uid]]++;
            total++;
        }

        let topIcons = Object.keys(summary).filter(k => summary[k] > 0).slice(0, 3).join("");
        let summaryText = total > 0 ? `${topIcons} ${total}` : 'Like';
        let ansAttr = answerId ? `data-answer-id="${answerId}"` : '';
        let pickerPos = answerId ? "right-full mr-3 top-1/2 -translate-y-1/2 origin-right" : "bottom-full right-0 mb-3 origin-bottom";
        let animation = answerId ? "slide-in-from-right-2" : "slide-in-from-bottom-2";

        return `
            <div class="reaction-container group relative" data-post-id="${postId}" ${ansAttr}>
              <div class="text-xs font-black text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 hover:bg-white hover:shadow-md transition-all cursor-pointer">${summaryText}</div>
              <div class="absolute ${pickerPos} hidden group-hover:flex bg-white rounded-full shadow-2xl border border-gray-100 p-1 animate-in fade-in ${animation} duration-200 z-[100] whitespace-nowrap">
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="👍">👍</span>
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="❤️">❤️</span>
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😂">😂</span>
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😮">😮</span>
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😢">😢</span>
                <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😡">😡</span>
              </div>
            </div>
        `;
    }

    function renderFeed(posts) {
        const t = getT();
        let container = $("#posts-container");
        container.empty();

        if (posts.length === 0) {
            container.html(`
                <div class="bg-white rounded-4xl p-20 text-center shadow-xl shadow-gray-100 text-gray-400 italic">
                  <h5 class="text-xl font-bold mb-2">${t.comm_no_questions}</h5>
                  <p>Be the first to ask!</p>
                </div>
            `);
            return;
        }

        posts.forEach(post => {
            let timeAgo = timeSince(post.timestamp);
            let firstChar = post.authorName ? post.authorName.charAt(0).toUpperCase() : "👤";
            let ansCount = post.answers ? Object.keys(post.answers).length : 0;
            let rxnHtml = buildReactionsHtml(post.id, post);

            let postHtml = `
            <div class="bg-white rounded-3xl shadow-xl shadow-gray-200/40 p-6 md:p-8 border border-gray-50 transition-all hover:shadow-2xl duration-300 animate-in fade-in slide-in-from-bottom-4" id="post-${post.id}">
                <div class="flex items-center gap-4 mb-6">
                  <div class="w-12 h-12 bg-accent text-primary text-xl font-black rounded-2xl flex items-center justify-center border-2 border-white shadow-md">
                    ${firstChar}
                  </div>
                  <div class="flex-grow">
                    <h6 class="font-extrabold text-gray-800 leading-none mb-1">${$("<div>").text(post.authorName).html()}</h6>
                    <small class="text-gray-400 text-[10px] uppercase font-black tracking-widest">${timeAgo}</small>
                  </div>
                  <div class="relative group">
                    <button class="w-8 h-8 rounded-full hover:bg-gray-100 transition-all text-gray-300">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all z-20 overflow-hidden">
                       <a href="#" class="block px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50"><i class="fas fa-bookmark mr-2"></i> Save</a>
                       ${currentUser && post.authorId === currentUser.id 
                           ? `<a href="#" onclick="deletePost('${post.id}')" class="block px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50"><i class="fas fa-trash-alt mr-2"></i> ${t.comm_delete}</a>`
                           : `<a href="#" class="block px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-50"><i class="fas fa-flag mr-2"></i> Report</a>`
                       }
                    </div>
                  </div>
                </div>
                
                <h5 class="text-2xl font-black text-primary mb-3 leading-tight">${$("<div>").text(post.title).html()}</h5>
                <p class="text-gray-600 mb-8 leading-relaxed">${$("<div>").text(post.content).html()}</p>
                
                <div class="flex justify-between items-center pt-6 border-t border-gray-50">
                    <div class="flex items-center gap-4">
                        ${rxnHtml}
                    </div>
                    <button onclick="openPostModal('${post.id}')" class="flex items-center gap-2 text-gray-400 hover:text-secondary transition-all text-sm font-black uppercase tracking-widest">
                      <i class="far fa-comment-dots text-lg"></i>
                      <span>${ansCount} ${t.comm_comments}</span>
                    </button>
                </div>
            </div>`;
            container.append(postHtml);
        });
    }

    window.openPostModal = function (postId) {
        $("#postDetailModal").attr("data-current-post", postId);
        renderPostModal(postId);
        openModal('postDetailModal');
    };

    function renderPostModal(postId) {
        const t = getT();
        let post = globalPostsData[postId];
        if (!post) return;

        let container = $("#post-detail-content");
        let firstChar = post.authorName ? post.authorName.charAt(0).toUpperCase() : "👤";
        let ansCount = post.answers ? Object.keys(post.answers).length : 0;
        
        // Prepare Reactions for Side Bar
        let rxns = post.reactions || {};
        let summary = { '👍': 0, '❤️': 0, '😂': 0, '😮': 0, '😢': 0, '😡': 0 };
        let totalRxns = 0;
        for (let uid in rxns) {
            summary[rxns[uid]]++;
            totalRxns++;
        }

        let answersHtml = '<div class="space-y-6">';
        if (post.answers) {
            let ansArray = [];
            for (let k in post.answers) ansArray.push({ id: k, ...post.answers[k] });
            ansArray.sort((a, b) => a.timestamp - b.timestamp);

            ansArray.forEach(ans => {
                let time = timeSince(ans.timestamp);
                let ansRxnHtml = buildReactionsHtml(postId, ans, ans.id);
                answersHtml += `
                <div class="group">
                    <div class="flex gap-4 mb-2">
                        <div class="w-8 h-8 bg-primary/5 text-primary text-xs font-black rounded-lg flex items-center justify-center flex-shrink-0">
                           ${ans.authorName ? ans.authorName.charAt(0).toUpperCase() : "👤"}
                        </div>
                        <div class="flex-grow">
                            <div class="bg-gray-100/50 p-4 rounded-2xl rounded-tl-none border border-transparent hover:border-gray-200 transition-all">
                                <div class="flex justify-between items-center mb-1">
                                   <strong class="text-sm font-black text-primary">${$("<div>").text(ans.authorName).html()}</strong>
                                   <small class="text-[9px] font-black text-gray-400 uppercase">${time}</small>
                                </div>
                                <p class="text-gray-600 text-sm leading-relaxed">${$("<div>").text(ans.content).html()}</p>
                            </div>
                            <div class="mt-1 flex justify-end">
                                ${ansRxnHtml}
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        } else {
            answersHtml += `<div class="text-center py-12 text-gray-400 italic text-sm">${t.comm_be_first}</div>`;
        }
        answersHtml += '</div>';

        let replyHtml = '';
        if (currentUser && post.authorId !== currentUser.id) {
            replyHtml = `
            <div class="p-6 bg-white border-t border-gray-100">
              <form class="reply-form flex gap-3" data-post-id="${postId}">
                <input type="text" class="flex-grow bg-gray-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl px-6 py-3 transition-all outline-none text-sm font-medium" placeholder="${t.comm_write_comment}" required>
                <button class="bg-primary text-white font-black px-6 rounded-2xl hover:bg-secondary transition-all shadow-lg shadow-primary/20" type="submit">${t.comm_send}</button>
              </form>
            </div>`;
        } else if (currentUser && post.authorId === currentUser.id) {
            replyHtml = `<div class="p-6 bg-white border-t border-gray-100 text-center"><small class="text-gray-400 font-bold uppercase tracking-widest text-[10px]">${t.comm_cannot_reply_own}</small></div>`;
        } else {
            replyHtml = `<div class="p-6 bg-white border-t border-gray-100 text-center"><small class="text-gray-400 font-bold uppercase tracking-widest text-[10px]"><a href="#" onclick="closeModal('postDetailModal'); openModal('loginModal'); return false;" class="text-primary hover:underline">${t.comm_login_link}</a> ${t.comm_signin_to_reply}.</small></div>`;
        }

        let fullHtml = `
          <div class="flex flex-col lg:flex-row h-full min-h-[80vh] lg:h-[85vh] overflow-hidden rounded-5xl">
            <!-- Left: Interaction Bar (Likes/Comments stats) -->
            <div class="hidden lg:flex w-20 flex-col items-center py-10 space-y-10 bg-white border-r border-gray-50">
               <div class="flex flex-col items-center gap-2 group cursor-pointer reaction-container relative" data-post-id="${post.id}">
                  <div class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                    <i class="fas fa-heart text-xl"></i>
                  </div>
                  <span class="text-xs font-black text-gray-400 uppercase">${totalRxns}</span>
                  <!-- Reaction Picker Hover -->
                  <div class="absolute left-full ml-4 hidden group-hover:flex bg-white rounded-full shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-left-2">
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="👍">👍</span>
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="❤️">❤️</span>
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😂">😂</span>
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😮">😮</span>
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😢">😢</span>
                    <span class="reaction-btn hover:scale-150 transition-transform cursor-pointer p-1.5 text-xl" data-type="😡">😡</span>
                  </div>
               </div>
               
               <div class="flex flex-col items-center gap-2 text-gray-300">
                  <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <i class="fas fa-comment-dots text-xl"></i>
                  </div>
                  <span class="text-xs font-black uppercase">${ansCount}</span>
               </div>

               <div class="flex flex-col items-center gap-2 group cursor-pointer text-gray-300 hover:text-secondary transition-colors">
                  <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-secondary/10">
                    <i class="fas fa-share-alt text-xl"></i>
                  </div>
                  <span class="text-xs font-black uppercase">Share</span>
               </div>
            </div>

            <!-- Center: Post Content -->
            <div class="flex-grow bg-white overflow-y-auto p-8 lg:p-14 no-scrollbar">
              <div class="flex items-center gap-4 mb-10">
                <div class="w-14 h-14 bg-gradient-to-br from-primary to-secondary text-white text-xl font-black rounded-2xl flex items-center justify-center shadow-xl border-2 border-white">
                  ${firstChar}
                </div>
                <div>
                  <h6 class="font-black text-gray-800 leading-none mb-1">${$("<div>").text(post.authorName).html()}</h6>
                  <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${timeSince(post.timestamp)}</p>
                </div>
              </div>

              <h2 class="text-3xl lg:text-4xl font-black text-primary leading-tight mb-6">${$("<div>").text(post.title).html()}</h2>
              <div class="max-w-none">
                <p class="text-lg lg:text-xl text-gray-600 leading-relaxed font-medium mb-4">${$("<div>").text(post.content).html()}</p>
              </div>
              
              <!-- Mobile Stats Bar -->
              <div class="flex lg:hidden items-center gap-6 mt-10 pt-6 border-t border-gray-50">
                 <div class="flex items-center gap-2 text-primary font-black text-sm">
                    <i class="fas fa-heart"></i> ${totalRxns}
                 </div>
                 <div class="flex items-center gap-2 text-gray-400 font-black text-sm">
                    <i class="fas fa-comment"></i> ${ansCount}
                 </div>
              </div>
            </div>

            <!-- Right: Comments Section -->
            <div class="w-full lg:w-[450px] bg-[#fcfdfe] border-l border-gray-50 flex flex-col h-full shadow-inner">
               <div class="p-6 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                  <h6 class="font-black text-gray-800 uppercase tracking-widest text-xs">${t.comm_comments} (${ansCount})</h6>
               </div>
               <div class="flex-grow overflow-y-auto p-6 no-scrollbar">
                  ${answersHtml}
               </div>
               ${replyHtml}
            </div>
          </div>
        `;

        container.html(fullHtml);
    }
    let pendingDeleteId = null;
    window.deletePost = function (postId) {
        pendingDeleteId = postId;
        openModal('deleteConfirmModal');
    };

    $("#confirmDeleteBtn").on("click", function () {
        if (!pendingDeleteId) return;
        let btn = $(this);
        btn.prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i>');

        $.ajax({
            url: `${DB_URL}/posts/${pendingDeleteId}.json`,
            type: 'DELETE',
            success: function () {
                closeModal('deleteConfirmModal');
                fetchPosts();
                btn.prop("disabled", false).text(getT().comm_confirm);
                pendingDeleteId = null;
            },
            error: function () {
                alert("Error deleting post");
                btn.prop("disabled", false).text(getT().comm_confirm);
            }
        });
    });

    // Initial load
    fetchPosts();
});
