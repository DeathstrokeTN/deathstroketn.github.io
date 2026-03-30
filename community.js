// community.js - Handles Firebase REST API logic via jQuery with Real-time & Rich Features

const DB_URL = "https://caregiver-c85e3-default-rtdb.europe-west1.firebasedatabase.app";

$(document).ready(function() {
    
    // --- STATE ---
    let currentUser = JSON.parse(localStorage.getItem("communityUser") || "null");
    let currentPostsHash = "";
    let globalPostsData = {};

    function updateAuthUI() {
        if (currentUser) {
            $("#auth-buttons").hide();
            $("#user-actions").show();
            $("#display-user-name").text(currentUser.name);
            fetchNotifs(); // Fetch immediately on login
        } else {
            $("#auth-buttons").show();
            $("#user-actions").hide();
            $("#notif-badge").hide();
        }
    }

    // Initialize UI
    updateAuthUI();

    // --- REGISTRATION LOGIC ---
    $("#register-form").submit(function(e) {
        e.preventDefault();
        let name = $("#reg-name").val().trim();
        let email = $("#reg-email").val().trim();
        let password = $("#reg-password").val();
        let $btn = $("#reg-submit-btn").prop("disabled", true).text("Creating...");

        let newUser = { name: name, email: email, password: password };
        $.ajax({
            url: `${DB_URL}/users.json`,
            type: 'POST',
            data: JSON.stringify(newUser),
            success: function(res) {
                currentUser = { id: res.name, name: name, email: email };
                localStorage.setItem("communityUser", JSON.stringify(currentUser));
                updateAuthUI();
                $("#registerModal").modal('hide');
                $("#register-form")[0].reset();
                $btn.prop("disabled", false).text("Create Account");
            },
            error: function() {
                $("#reg-error").show();
                $btn.prop("disabled", false).text("Create Account");
            }
        });
    });

    // --- LOGIN LOGIC ---
    $("#login-form").submit(function(e) {
        e.preventDefault();
        let email = $("#login-email").val().trim();
        let password = $("#login-password").val();
        let $btn = $("#login-submit-btn").prop("disabled", true).text("Logging in...");
        $("#login-error").hide();

        $.ajax({
            url: `${DB_URL}/users.json`,
            type: 'GET',
            success: function(data) {
                let userFound = false;
                if (data) {
                    for (let key in data) {
                        let u = data[key];
                        if (u.email === email && u.password === password) {
                            currentUser = { id: key, name: u.name, email: u.email };
                            localStorage.setItem("communityUser", JSON.stringify(currentUser));
                            updateAuthUI();
                            $("#loginModal").modal('hide');
                            $("#login-form")[0].reset();
                            userFound = true;
                            break;
                        }
                    }
                }
                if (!userFound) $("#login-error").show();
                $btn.prop("disabled", false).text("Login");
            },
            error: function() {
                $("#login-error").text("Error connecting to server.").show();
                $btn.prop("disabled", false).text("Login");
            }
        });
    });

    // --- LOGOUT LOGIC ---
    $("#logout-btn").click(function() {
        currentUser = null;
        localStorage.removeItem("communityUser");
        updateAuthUI();
    });

    // --- SUBMIT QUESTION LOGIC ---
    $("#ask-form").submit(function(e) {
        e.preventDefault();
        if (!currentUser) return alert("You must be logged in to post.");

        let title = $("#post-title").val().trim();
        let content = $("#post-content").val().trim();
        let $btn = $("#post-submit-btn").prop("disabled", true).text("Posting...");

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
            success: function(res) {
                $("#askModal").modal('hide');
                $("#ask-form")[0].reset();
                $btn.prop("disabled", false).text("Post Question");
                fetchPosts(); // Fast refresh
            },
            error: function() {
                alert("An error occurred while posting.");
                $btn.prop("disabled", false).text("Post Question");
            }
        });
    });

    // --- REAL-TIME POLLING: POSTS ---
    function fetchPosts() {
        $.ajax({
            url: `${DB_URL}/posts.json`,
            type: 'GET',
            success: function(data) {
                let hash = JSON.stringify(data || {});
                if (hash !== currentPostsHash) {
                    currentPostsHash = hash;
                    globalPostsData = data || {};
                    processPosts(data);
                    
                    // If modal is open, re-render its content
                    let openPostId = $("#postDetailModal").attr("data-current-post");
                    if (openPostId && $("#postDetailModal").hasClass("show")) {
                        renderPostModal(openPostId);
                    }
                }
            }
        });
    }
    
    // Auto-retrieve every 3 seconds
    setInterval(fetchPosts, 3000);

    // --- REAL-TIME POLLING: NOTIFICATIONS ---
    function fetchNotifs() {
        if (!currentUser) return;
        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/notifications.json`,
            type: 'GET',
            success: function(data) {
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
                    list.html('<li class="text-center text-muted small py-2">No new notifications</li>');
                    $("#notif-badge").hide();
                    return;
                }

                notifsArray.sort((a, b) => b.timestamp - a.timestamp);
                
                notifsArray.forEach(n => {
                    if (!n.read) unreadCount++;
                    let timeStr = timeSince(n.timestamp);
                    let bg = n.read ? "bg-white" : "bg-light";
                    list.append(`
                        <li>
                           <a class="dropdown-item ${bg} border-bottom py-2 notif-item" href="#" data-id="${n.id}" data-post-id="${n.postId}">
                             <p class="mb-0 small"><strong>${$("<div>").text(n.actorName).html()}</strong> replied to your post.</p>
                             <small class="text-muted" style="font-size: 0.75rem">${timeStr}</small>
                           </a>
                        </li>
                    `);
                });

                if (unreadCount > 0) {
                    $("#notif-badge").text(unreadCount).show();
                } else {
                    $("#notif-badge").hide();
                }
            }
        });
    }

    // Auto-retrieve notifs every 5 seconds
    setInterval(fetchNotifs, 5000);

    // Clicking a notification
    $(document).on("click", ".notif-item", function(e) {
        e.preventDefault();
        let notifId = $(this).data("id");
        let postId = $(this).data("post-id");
        
        // Mark as read
        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/notifications/${notifId}.json`,
            type: 'PATCH',
            data: JSON.stringify({ read: true }),
            success: function() {
                fetchNotifs();
            }
        });

        // Open modal
        openPostModal(postId);
    });

    // --- REPLIES LOGIC ---
    $(document).on("submit", ".reply-form", function(e) {
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

        // Post answer
        $.ajax({
            url: `${DB_URL}/posts/${postId}/answers.json`,
            type: 'POST',
            data: JSON.stringify(newReply),
            success: function() {
                // If the replier is NOT the author of the post, send a notification
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
                fetchPosts(); // Trigger immediate update
            },
            error: function() {
                alert("Failed to submit reply.");
                $btn.prop("disabled", false);
            }
        });
    });

    // --- FB REACTIONS LOGIC ---
    $(document).on("click", ".reaction-btn", function() {
        if (!currentUser) return alert("You must sign in to react.");
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
             success: function() { fetchPosts(); } // trigger update
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
        let seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "Just now";
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

        return `
            <div class="reaction-container" data-post-id="${postId}" ${ansAttr}>
              <div class="reaction-summary fw-bold">${summaryText}</div>
              <div class="reaction-bar">
                <span class="reaction-btn" data-type="👍">👍</span>
                <span class="reaction-btn" data-type="❤️">❤️</span>
                <span class="reaction-btn" data-type="😂">😂</span>
                <span class="reaction-btn" data-type="😮">😮</span>
                <span class="reaction-btn" data-type="😢">😢</span>
                <span class="reaction-btn" data-type="😡">😡</span>
              </div>
            </div>
        `;
    }

    // Main Feed Render (Only shows summary of comments)
    function renderFeed(posts) {
        let container = $("#posts-container");
        container.empty();

        if (posts.length === 0) {
            container.html(`
                <div class="alert bg-light border-0 text-center p-5 rounded-4 text-muted"><h5>No questions yet.</h5></div>
            `);
            return;
        }

        posts.forEach(post => {
            let timeAgo = timeSince(post.timestamp);
            let firstChar = post.authorName ? post.authorName.charAt(0).toUpperCase() : "👤";
            let ansCount = post.answers ? Object.keys(post.answers).length : 0;
            let rxnHtml = buildReactionsHtml(post.id, post);

            let postHtml = `
            <div class="card border-0 shadow-sm mb-4 rounded-4" id="post-${post.id}">
              <div class="card-body p-4">
                <div class="d-flex mb-3 align-items-center">
                  <div class="bg-light text-primary-custom fw-bold rounded-circle d-flex justify-content-center align-items-center me-3 fs-5" style="width: 50px; height: 50px;">
                    ${firstChar}
                  </div>
                  <div>
                    <h5 class="mb-0 fw-bold">${$("<div>").text(post.title).html()}</h5>
                    <small class="text-muted">Posted ${timeAgo} by ${$("<div>").text(post.authorName).html()}</small>
                  </div>
                </div>
                <div class="mb-3 text-dark">
                  <p class="mb-0">${$("<div>").text(post.content).html()}</p>
                </div>
                
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                    ${rxnHtml}
                    <div class="view-full-post text-muted small fw-bold" onclick="openPostModal('${post.id}')">
                      💬 ${ansCount} Comments
                    </div>
                </div>
              </div>
            </div>`;
            container.append(postHtml);
        });
    }

    // Modal Rendering (Shows Full Post + All Comments + Reply Box)
    window.openPostModal = function(postId) {
        $("#postDetailModal").attr("data-current-post", postId); // store tracking ID
        let modal = new bootstrap.Modal(document.getElementById('postDetailModal'));
        renderPostModal(postId); // build HTMl
        modal.show();
    };

    function renderPostModal(postId) {
        let post = globalPostsData[postId];
        if(!post) return;
        
        let container = $("#post-detail-content");
        let firstChar = post.authorName ? post.authorName.charAt(0).toUpperCase() : "👤";
        let rxnHtml = buildReactionsHtml(post.id, post);

        // Build Comments
        let answersHtml = '<div class="mt-4 px-2">';
        if (post.answers) {
            let ansArray = [];
            for (let k in post.answers) ansArray.push({ id: k, ...post.answers[k] });
            ansArray.sort((a, b) => a.timestamp - b.timestamp);
            
            ansArray.forEach(ans => {
                let time = timeSince(ans.timestamp);
                let ansRxnHtml = buildReactionsHtml(post.id, ans, ans.id);
                answersHtml += `
                <div class="d-flex mb-3">
                    <div class="bg-secondary text-white fw-bold rounded-circle d-flex justify-content-center align-items-center me-3" style="width: 35px; height: 35px; font-size: 0.8rem; flex-shrink: 0;">
                       ${ans.authorName ? ans.authorName.charAt(0).toUpperCase() : "👤"}
                    </div>
                    <div class="bg-white p-3 rounded-4 shadow-sm w-100 border">
                        <div class="d-flex justify-content-between mb-1">
                           <strong style="font-size: 0.9rem;">${$("<div>").text(ans.authorName).html()}</strong>
                           <small class="text-muted" style="font-size: 0.75rem;">${time}</small>
                        </div>
                        <p class="mb-2" style="font-size: 0.95rem;">${$("<div>").text(ans.content).html()}</p>
                        ${ansRxnHtml}
                    </div>
                </div>`;
            });
        } else {
            answersHtml += `<p class="text-center text-muted small my-4">No comments yet. Be the first!</p>`;
        }
        answersHtml += '</div>';

        // Build Reply Box
        let replyHtml = '';
        if (currentUser && post.authorId !== currentUser.id) {
            replyHtml = `
            <div class="mt-4 p-3 bg-white border-top position-sticky bottom-0">
              <form class="reply-form" data-post-id="${postId}">
                <div class="input-group dropup">
                  <input type="text" class="form-control bg-light border-0 rounded-start-pill ps-4" placeholder="Write a comment..." required>
                  <button class="btn btn-primary-custom rounded-end-pill px-4" type="submit">Send</button>
                </div>
              </form>
            </div>`;
        } else if (currentUser && post.authorId === currentUser.id) {
            replyHtml = `<div class="mt-4 p-3 border-top text-center"><small class="text-muted">You cannot reply to your own question.</small></div>`;
        } else {
            replyHtml = `<div class="mt-4 p-3 border-top text-center"><small class="text-muted"><a href="#" data-bs-toggle="modal" data-bs-target="#loginModal" data-bs-dismiss="modal">Sign in</a> to reply.</small></div>`;
        }

        let fullHtml = `
          <div class="p-4 bg-white border-bottom shadow-sm z-1 position-relative">
            <div class="d-flex mb-3 align-items-center">
              <div class="bg-light text-primary-custom fw-bold rounded-circle d-flex justify-content-center align-items-center me-3 fs-3" style="width: 60px; height: 60px;">
                ${firstChar}
              </div>
              <div>
                <h4 class="mb-0 fw-bold">${$("<div>").text(post.title).html()}</h4>
                <div class="text-muted small">Posted ${timeSince(post.timestamp)} by ${$("<div>").text(post.authorName).html()}</div>
              </div>
            </div>
            <p class="fs-5 mb-4 text-dark" style="line-height: 1.6;">${$("<div>").text(post.content).html()}</p>
            ${rxnHtml}
          </div>
          <div style="background-color: #f7fafc;">
            ${answersHtml}
          </div>
          ${replyHtml}
        `;

        container.html(fullHtml);
    }

    // Initial load
    fetchPosts();
});
