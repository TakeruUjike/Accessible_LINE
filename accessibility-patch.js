(function() {
    console.log("Accessibility Patch Loaded.");

    // CSS injection for focus outline, screen reader helpers, and message layout direction override
    try {
        const style = document.createElement('style');
        style.innerHTML = `
            *:focus {
                outline: 3px solid #06c755 !important;
                outline-offset: 2px !important;
            }
            /* Make sure focus outlines are not hidden by overflow */
            [class*="chatlistItem-module__chatlist_item__"]:focus-within,
            [class*="friendlistItem-module__item__"]:focus-within,
            [class*="folderTab-module__tab_item__"]:focus {
                z-index: 10 !important;
            }
            /* Dynamic Message List Direction Override (Fixes时系列 chronological order dynamically) */
            [class*="chatroomContent-module__content_area__"] .message_list,
            [class*="chatroomContent-module__content_area__"] [class*="message_list"] {
                display: flex !important;
                flex-direction: column !important; /* Ensures messages read top-to-bottom chronologically */
            }
        `;
        document.head.appendChild(style);
        console.log("Accessibility CSS overrides injected successfully.");
    } catch (e) {
        console.error("Accessibility Patch: CSS injection failed", e);
    }

    // 1. Announcer region for Screen Readers (Live Region) - Safely deferred
    let announcer = null;
    function initAnnouncer() {
        if (announcer) return;
        try {
            announcer = document.getElementById('sr-announcer');
            if (!announcer && document.body) {
                announcer = document.createElement('div');
                announcer.id = 'sr-announcer';
                announcer.setAttribute('aria-live', 'polite');
                announcer.setAttribute('aria-atomic', 'true');
                // Visually hidden styles (sr-only)
                announcer.style.position = 'absolute';
                announcer.style.width = '1px';
                announcer.style.height = '1px';
                announcer.style.padding = '0';
                announcer.style.margin = '-1px';
                announcer.style.overflow = 'hidden';
                announcer.style.clip = 'rect(0, 0, 0, 0)';
                announcer.style.border = '0';
                document.body.appendChild(announcer);
                console.log("Accessibility Announcer initialized.");
            }
        } catch (e) {
            console.error("Accessibility Patch: Failed to initialize announcer", e);
        }
    }

    function announce(message) {
        initAnnouncer();
        if (announcer) {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 100);
        }
    }

    // Simulate both mouse events and click to trigger React state transitions correctly
    function simulateClick(el) {
        try {
            const opts = { bubbles: true, cancelable: true, view: window };
            // Trigger mousedown (many React tab components listen here)
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            // Focus the element
            el.focus();
            // Trigger mouseup
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            // Trigger click
            el.click();
        } catch (e) {
            console.error("Accessibility Patch: Click simulation failed", e);
        }
    }

    // Helper to add accessibility to non-interactive elements that should be interactive
    function makeInteractive(el, role = 'button', label = null) {
        if (!el) return;
        try {
            // Add tabindex if not present
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
            
            // Add role if not present
            if (!el.hasAttribute('role')) {
                el.setAttribute('role', role);
            }

            // Add aria-label (always overwrite to replace poor defaults like "go chat room")
            if (label) {
                el.setAttribute('aria-label', label);
            }

            // Handle Enter and Space key presses
            if (!el.dataset.keyboardHandlerAttached) {
                el.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); // Stop standard browser behavior
                        simulateClick(el);  // Trigger complete mouse click sequence
                    }
                });
                el.dataset.keyboardHandlerAttached = 'true';
            }
        } catch (e) {
            console.error("Accessibility Patch: makeInteractive failed", e);
        }
    }

    // Modal trap logic
    let activeModal = null;
    let modalFocusElements = [];

    function checkModalRoot() {
        try {
            const modalRoot = document.getElementById('modal-root');
            if (!modalRoot) return;

            const modal = modalRoot.firstElementChild;
            if (modal && modal !== activeModal) {
                activeModal = modal;
                if (!modal.getAttribute('role')) {
                    modal.setAttribute('role', 'dialog');
                    modal.setAttribute('aria-modal', 'true');
                }
                
                updateModalFocusElements(modal);
                
                if (modalFocusElements.length > 0) {
                    modalFocusElements[0].focus();
                }

                if (!modal.dataset.focusTrapAttached) {
                    modal.addEventListener('keydown', handleModalKeyDown);
                    modal.dataset.focusTrapAttached = 'true';
                }
                announce("ダイアログが開きました。");
            } else if (!modal && activeModal) {
                activeModal = null;
                modalFocusElements = [];
                announce("ダイアログが閉じました。");
            }
        } catch (e) {
            console.error("Accessibility Patch: Modal check failed", e);
        }
    }

    function updateModalFocusElements(modal) {
        try {
            const selector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
            modalFocusElements = Array.from(modal.querySelectorAll(selector));
        } catch (e) {
            console.error("Accessibility Patch: Failed to update modal focus elements", e);
        }
    }

    function handleModalKeyDown(e) {
        try {
            if (e.key === 'Tab') {
                updateModalFocusElements(activeModal);
                if (modalFocusElements.length === 0) return;

                const firstEl = modalFocusElements[0];
                const lastEl = modalFocusElements[modalFocusElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        lastEl.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        firstEl.focus();
                        e.preventDefault();
                    }
                }
            } else if (e.key === 'Escape') {
                const closeBtn = activeModal.querySelector('button[class*="close"], button[aria-label*="閉じる"], [class*="btn_close"]');
                if (closeBtn) {
                    closeBtn.click();
                    e.preventDefault();
                }
            }
        } catch (err) {
            console.error("Accessibility Patch: Modal keydown handler error", err);
        }
    }

    // Extract text from message node for live announcement
    function getMessageText(msgEl) {
        if (!msgEl) return "";
        try {
            const classStr = msgEl.className ? msgEl.className.toString() : '';
            if (classStr.includes('systemMessage') || msgEl.querySelector('[class*="systemMessage"]')) {
                return msgEl.textContent.trim();
            }

            const nameEl = msgEl.querySelector('[class*="name"], [class*="sender"], [class*="nickname"], [class*="profile"]');
            let sender = "";
            if (nameEl) {
                sender = nameEl.textContent.trim();
            } else {
                const isMyMessage = msgEl.querySelector('[class*="my"], [class*="outgoing"]') || 
                                   classStr.includes('my') || 
                                   classStr.includes('outgoing');
                sender = isMyMessage ? "自分" : "相手";
            }

            let bodyText = "";
            const bodyEl = msgEl.querySelector('[class*="content_inner"], [class*="text"], [class*="bubble"], [class*="body_text"]');
            if (bodyEl) {
                bodyText = bodyEl.textContent.trim();
            } else {
                const clone = msgEl.cloneNode(true);
                clone.querySelectorAll('time, [class*="time"], [class*="read"], [class*="avatar"], [class*="profile"]').forEach(el => el.remove());
                bodyText = clone.textContent.trim();
            }

            if (!bodyText) {
                if (msgEl.querySelector('img')) {
                    bodyText = "[画像]";
                } else if (msgEl.querySelector('[class*="sticker"], [class*="emoticon"], [class*="emoji"]')) {
                    bodyText = "[スタンプまたは絵文字]";
                } else if (msgEl.querySelector('[class*="file"]')) {
                    bodyText = "[ファイル]";
                } else {
                    bodyText = "[メッセージ]";
                }
            }

            return `${sender}: ${bodyText}`;
        } catch (e) {
            console.error("Accessibility Patch: getMessageText failed", e);
            return "";
        }
    }

    // Safe stringification helper
    function getSafeClassName(el) {
        if (!el || !el.className) return "";
        return typeof el.className.toString === 'function' ? el.className.toString() : '';
    }

    // Main patch function called on DOM load and DOM changes
    function patchDOM() {
        initAnnouncer(); // Ensure announcer is initialized safely

        // 1. Tabs (folderTab - "すべて", "グループ", "公式アカウント" など) - Hash-independent
        try {
            const tabs = document.querySelectorAll('[class*="folderTab-module__tab_item__"]');
            tabs.forEach(tab => {
                const name = tab.textContent || 'タブ';
                makeInteractive(tab, 'tab', name);
                const isSelected = tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active');
                tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            });
        } catch (e) { console.error("Patch Error (Tabs):", e); }

        // 2. Chat list items - Hash-independent
        try {
            const chatItems = document.querySelectorAll('[class*="chatlistItem-module__chatlist_item__"]');
            chatItems.forEach(item => {
                const titleEl = item.querySelector('[class*="chatlistItem-module__title_box__"]');
                const title = titleEl ? titleEl.textContent.trim() : 'トーク';
                
                const countEl = item.querySelector('[class*="chatlistItem-module__message_count__"]');
                const unreadText = countEl ? `, 未読${countEl.textContent.trim()}件` : '';
                
                const descEl = item.querySelector('[class*="chatlistItem-module__description__"]');
                const desc = descEl ? `, 最新メッセージ: ${descEl.textContent.trim()}` : '';

                const timeEl = item.querySelector('[class*="chatlistItem-module__date__"]');
                const time = timeEl ? `, ${timeEl.textContent.trim()}` : '';

                const ariaLabel = `${title}${unreadText}${desc}${time}`;

                const clickBtn = item.querySelector('button[class*="button_chatlist_item"]');
                if (clickBtn) {
                    makeInteractive(clickBtn, 'link', ariaLabel);
                } else {
                    makeInteractive(item, 'link', ariaLabel);
                }
            });
        } catch (e) { console.error("Patch Error (ChatList):", e); }

        // 3. Friend list items - Hash-independent
        try {
            const friendItems = document.querySelectorAll('[class*="friendlistItem-module__item__"]');
            friendItems.forEach(item => {
                const nameEl = item.querySelector('[class*="friendlistItem-module__name_box__"]');
                const name = nameEl ? nameEl.textContent.trim() : '友だち';

                const descEl = item.querySelector('[class*="friendlistItem-module__description__"]');
                const desc = descEl ? `, ステータスメッセージ: ${descEl.textContent.trim()}` : '';

                const ariaLabel = `${name}${desc}`;

                const clickBtn = item.querySelector('button[role="link"], button[class*="button_friend"]');
                if (clickBtn) {
                    makeInteractive(clickBtn, 'button', ariaLabel);
                } else {
                    makeInteractive(item, 'button', ariaLabel);
                }
            });
        } catch (e) { console.error("Patch Error (FriendList):", e); }

        // 4. Other custom buttons (e.g. create chat room, add friend) - Hash-independent
        try {
            const customButtons = document.querySelectorAll(
                '[class*="button_create"], [class*="button_add"], [class*="button_option"], [class*="createChatButton-module__button_create__"]'
            );
            customButtons.forEach(btn => {
                let label = btn.getAttribute('aria-label') || btn.textContent.trim();
                if (!label) {
                    const classStr = getSafeClassName(btn).toLowerCase();
                    if (classStr.includes('create')) {
                        label = '新規トーク作成';
                    } else if (classStr.includes('add')) {
                        label = '友だち追加';
                    } else if (classStr.includes('option')) {
                        label = 'オプション';
                    } else {
                        label = 'ボタン';
                    }
                }
                makeInteractive(btn, 'button', label);
            });
        } catch (e) { console.error("Patch Error (CustomButtons):", e); }

        // 5. Message list unread label & date headers (Heading level 2) - Hash-independent
        try {
            const dateHeaders = document.querySelectorAll('[class*="messageDate-module__date_wrap__"]');
            dateHeaders.forEach(header => {
                if (header.getAttribute('role') !== 'heading') {
                    header.setAttribute('role', 'heading');
                    header.setAttribute('aria-level', '2');
                    const timeEl = header.querySelector('time');
                    if (timeEl) {
                        header.setAttribute('aria-label', timeEl.textContent);
                    }
                }
            });
        } catch (e) { console.error("Patch Error (DateHeaders):", e); }

        // 6. GNB (Global Navigation Bar) icons/tabs on the left (e.g. Chats, Friends) - Hash-independent
        try {
            const rawGnbItems = Array.from(document.querySelectorAll(
                '[class*="gnb"] button, [class*="gnb"] a, [class*="gnb"] li, [class*="gnb"] [class*="button"], [class*="gnb-module__nav_list_item"]'
            ));
            
            // 重複を排除：子孫に他のGNB候補要素を持つ要素（親コンテナ）は除外する
            const activeGnbItems = [];
            const containerGnbItems = [];
            
            rawGnbItems.forEach(item => {
                const hasChildCandidate = rawGnbItems.some(otherItem => {
                    return otherItem !== item && item.contains(otherItem);
                });
                if (hasChildCandidate) {
                    containerGnbItems.push(item);
                } else {
                    activeGnbItems.push(item);
                }
            });

            // 親コンテナからは、過去のパッチや標準で付与された不要なアクセシビリティ属性をクリアする
            containerGnbItems.forEach(container => {
                container.removeAttribute('role');
                container.removeAttribute('tabindex');
                container.removeAttribute('aria-label');
                container.removeAttribute('aria-selected');
                container.removeAttribute('aria-pressed');
            });

            activeGnbItems.forEach(item => {
                let label = item.getAttribute('aria-label') || item.title || item.textContent.trim();
                if (!label) {
                    const classStr = getSafeClassName(item).toLowerCase();
                    if (classStr.includes('friend')) label = '友だち一覧';
                    else if (classStr.includes('chat')) label = 'トーク一覧';
                    else if (classStr.includes('timeline') || classStr.includes('voom')) label = 'VOOM';
                    else if (classStr.includes('keep')) label = 'Keep';
                    else if (classStr.includes('setting')) label = '設定';
                    else label = 'メニュー項目';
                }
                
                // roleを強制的に'button'にして、NVDAブラウズモードでの上下矢印アクセスを保証する
                item.setAttribute('role', 'button');
                makeInteractive(item, 'button', label);

                // トグル状態（aria-pressed）や選択状態（aria-selected）は
                // 画面切り替えの通常のボタンとして扱うため、不要な属性をクリアして普通のボタンに戻す
                item.removeAttribute('aria-pressed');
                item.removeAttribute('aria-selected');
            });
        } catch (e) { console.error("Patch Error (GNB):", e); }

        // 7. Talkroom title header (H1) - Hash-independent
        try {
            const chatHeader = document.querySelector('[class*="chatroomHeader-module__name__"]');
            if (chatHeader && chatHeader.getAttribute('role') !== 'heading') {
                chatHeader.setAttribute('role', 'heading');
                chatHeader.setAttribute('aria-level', '1');
                console.log("Applied H1 heading to chatroom title: " + chatHeader.textContent);
            }
        } catch (e) { console.error("Patch Error (ChatroomHeader):", e); }

        // 8. Remove list/listitem roles to prevent screen reader repeating the date header for each message - Hash-independent
        try {
            const messageList = document.querySelector('.message_list') || document.querySelector('[class*="message_list"]');
            if (messageList) {
                messageList.removeAttribute('role');
            }
            
            const messages = document.querySelectorAll('.message_list [data-message-id]') || 
                             document.querySelectorAll('[class*="message_list"] [data-message-id]');
            messages.forEach(msg => {
                msg.removeAttribute('role');
                msg.removeAttribute('aria-level');
            });
        } catch (e) { console.error("Patch Error (MessageRoles):", e); }

        // 9. Input textarea accessibility label - Hash-independent
        try {
            const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
            if (textarea && !textarea.getAttribute('aria-label')) {
                textarea.setAttribute('aria-label', 'メッセージを入力');
            }
        } catch (e) { console.error("Patch Error (Textarea):", e); }

        // 10. Editor buttons accessibility labels - Hash-independent
        try {
            const editorButtons = document.querySelectorAll('[class*="chatroomEditor"] button, [class*="chatroomEditor"] [role="button"]');
            editorButtons.forEach(btn => {
                if (btn.getAttribute('aria-label')) return;
                const classStr = getSafeClassName(btn).toLowerCase();
                const text = btn.textContent.trim().toLowerCase();
                
                if (classStr.includes('sticker') || classStr.includes('stamp')) {
                    btn.setAttribute('aria-label', 'スタンプを選択');
                } else if (classStr.includes('emoji') || classStr.includes('emoticon')) {
                    btn.setAttribute('aria-label', '絵文字を選択');
                } else if (classStr.includes('file') || classStr.includes('upload') || classStr.includes('attachment')) {
                    btn.setAttribute('aria-label', 'ファイルを添付');
                } else if (classStr.includes('send') || text.includes('送信') || btn.querySelector('[class*="send"]')) {
                    btn.setAttribute('aria-label', 'メッセージを送信');
                } else {
                    const img = btn.querySelector('img');
                    if (img && img.alt) {
                        btn.setAttribute('aria-label', img.alt);
                    }
                }
            });
        } catch (e) { console.error("Patch Error (EditorButtons):", e); }

        // 11. Modal check - Hash-independent
        try {
            checkModalRoot();
        } catch (e) { console.error("Patch Error (ModalCheck):", e); }
    }

    // Run patch on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchDOM);
    } else {
        patchDOM();
    }

    // Monitor DOM mutations to patch newly loaded items dynamically and announce new messages
    let currentChatroomId = null;
    let isInitialLoading = true;
    let initialLoadTimeout = null;
    let lastAnnouncedMsgId = null;

    try {
        const observer = new MutationObserver((mutations) => {
            try {
                const headerEl = document.querySelector('[class*="chatroomHeader-module__name__"]');
                const chatroomId = headerEl ? headerEl.textContent.trim() : null;

                if (chatroomId !== currentChatroomId) {
                    currentChatroomId = chatroomId;
                    isInitialLoading = true;
                    if (initialLoadTimeout) clearTimeout(initialLoadTimeout);
                    
                    initialLoadTimeout = setTimeout(() => {
                        isInitialLoading = false;
                        const allMsgs = document.querySelectorAll('.message_list [data-message-id]') || 
                                        document.querySelectorAll('[class*="message_list"] [data-message-id]');
                        if (allMsgs.length > 0) {
                            lastAnnouncedMsgId = allMsgs[allMsgs.length - 1].getAttribute('data-message-id');
                        }
                    }, 2000);
                    
                    if (chatroomId) {
                        announce(`${chatroomId}とのトークルームを開きました`);
                    }
                }

                let shouldPatch = false;
                let newMessages = [];

                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        shouldPatch = true;
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.hasAttribute('data-message-id')) {
                                    newMessages.push(node);
                                } else {
                                    const msgs = node.querySelectorAll('[data-message-id]');
                                    msgs.forEach(m => newMessages.push(m));
                                }
                            }
                        });
                    }
                }

                if (shouldPatch) {
                    patchDOM();
                    
                    if (!isInitialLoading && newMessages.length > 0) {
                        const allMessages = Array.from(document.querySelectorAll('.message_list [data-message-id]') || 
                                                       document.querySelectorAll('[class*="message_list"] [data-message-id]'));
                        if (allMessages.length > 0) {
                            const latestMsg = allMessages[allMessages.length - 1];
                            const latestMsgId = latestMsg.getAttribute('data-message-id');
                            
                            if (latestMsgId !== lastAnnouncedMsgId) {
                                lastAnnouncedMsgId = latestMsgId;
                                const text = getMessageText(latestMsg);
                                if (text) {
                                    announce(text);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Accessibility Patch: Mutation Observer iteration error", err);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } catch (e) {
        console.error("Accessibility Patch: MutationObserver initialization failed", e);
    }
})();
