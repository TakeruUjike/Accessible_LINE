(function() {
    console.log("Accessibility Patch Loaded.");

    // CSS injection for focus outline and screen reader helpers
    const style = document.createElement('style');
    style.innerHTML = `
        *:focus {
            outline: 3px solid #06c755 !important;
            outline-offset: 2px !important;
        }
        /* Make sure focus outlines are not hidden by overflow */
        .chatlistItem-module__chatlist_item__MOwxh:focus-within,
        .friendlistItem-module__item__1tuZn:focus-within,
        .folderTab-module__tab_item__7dbuI:focus {
            z-index: 10 !important;
        }
    `;
    document.head.appendChild(style);

    // 1. Announcer region for Screen Readers (Live Region)
    let announcer = document.getElementById('sr-announcer');
    if (!announcer) {
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
    }

    function announce(message) {
        if (announcer) {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 100);
        }
    }

    // Simulate both mouse events and click to trigger React state transitions correctly
    function simulateClick(el) {
        const opts = { bubbles: true, cancelable: true, view: window };
        // Trigger mousedown (many React tab components listen here)
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        // Focus the element
        el.focus();
        // Trigger mouseup
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        // Trigger click
        el.click();
    }

    // Helper to add accessibility to non-interactive elements that should be interactive
    function makeInteractive(el, role = 'button', label = null) {
        if (!el) return;
        
        // Add tabindex if not present
        if (!el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex', '0');
        }
        
        // Add role if not present
        if (!el.hasAttribute('role')) {
            el.setAttribute('role', role);
        }

        // Add aria-label if specified (always overwrite to replace poor defaults like "go chat room")
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
    }

    // Modal trap logic
    let activeModal = null;
    let modalFocusElements = [];

    function checkModalRoot() {
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
    }

    function updateModalFocusElements(modal) {
        const selector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
        modalFocusElements = Array.from(modal.querySelectorAll(selector));
    }

    function handleModalKeyDown(e) {
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
    }

    // Extract text from message node for live announcement
    function getMessageText(msgEl) {
        if (!msgEl) return "";
        
        if (msgEl.classList.toString().includes('systemMessage') || msgEl.querySelector('[class*="systemMessage"]')) {
            return msgEl.textContent.trim();
        }

        const nameEl = msgEl.querySelector('[class*="name"], [class*="sender"], [class*="nickname"], [class*="profile"]');
        let sender = "";
        if (nameEl) {
            sender = nameEl.textContent.trim();
        } else {
            const isMyMessage = msgEl.querySelector('[class*="my"], [class*="outgoing"]') || 
                               msgEl.classList.toString().includes('my') || 
                               msgEl.classList.toString().includes('outgoing');
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
    }

    // Main patch function called on DOM load and DOM changes
    function patchDOM() {
        // 1. Tabs (folderTab - "すべて", "グループ", "公式アカウント" など)
        const tabs = document.querySelectorAll('.folderTab-module__tab_item__7dbuI');
        tabs.forEach(tab => {
            const name = tab.textContent || 'タブ';
            makeInteractive(tab, 'tab', name);
            const isSelected = tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active');
            tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });

        // 2. Chat list items
        const chatItems = document.querySelectorAll('.chatlistItem-module__chatlist_item__MOwxh');
        chatItems.forEach(item => {
            const titleEl = item.querySelector('.chatlistItem-module__title_box__aDNJD');
            const title = titleEl ? titleEl.textContent.trim() : 'トーク';
            
            const countEl = item.querySelector('.chatlistItem-module__message_count__FRt4s');
            const unreadText = countEl ? `, 未読${countEl.textContent.trim()}件` : '';
            
            const descEl = item.querySelector('.chatlistItem-module__description__JH3NE');
            const desc = descEl ? `, 最新メッセージ: ${descEl.textContent.trim()}` : '';

            const timeEl = item.querySelector('.chatlistItem-module__date__tG-MV');
            const time = timeEl ? `, ${timeEl.textContent.trim()}` : '';

            const ariaLabel = `${title}${unreadText}${desc}${time}`;

            const clickBtn = item.querySelector('button[class*="button_chatlist_item"]');
            if (clickBtn) {
                makeInteractive(clickBtn, 'link', ariaLabel);
            } else {
                makeInteractive(item, 'link', ariaLabel);
            }
        });

        // 3. Friend list items
        const friendItems = document.querySelectorAll('.friendlistItem-module__item__1tuZn');
        friendItems.forEach(item => {
            const nameEl = item.querySelector('.friendlistItem-module__name_box__fUKhX');
            const name = nameEl ? nameEl.textContent.trim() : '友だち';

            const descEl = item.querySelector('.friendlistItem-module__description__y36vl');
            const desc = descEl ? `, ステータスメッセージ: ${descEl.textContent.trim()}` : '';

            const ariaLabel = `${name}${desc}`;

            const clickBtn = item.querySelector('button[role="link"], button[class*="button_friend"]');
            if (clickBtn) {
                makeInteractive(clickBtn, 'button', ariaLabel);
            } else {
                makeInteractive(item, 'button', ariaLabel);
            }
        });

        // 4. Other custom buttons (e.g. create chat room, add friend)
        const customButtons = document.querySelectorAll(
            '[class*="button_create"], [class*="button_add"], [class*="button_option"], .createChatButton-module__button_create__-BK-p'
        );
        customButtons.forEach(btn => {
            let label = btn.getAttribute('aria-label') || btn.textContent.trim();
            if (!label) {
                if (btn.classList.toString().includes('create')) {
                    label = '新規トーク作成';
                } else if (btn.classList.toString().includes('add')) {
                    label = '友だち追加';
                } else if (btn.classList.toString().includes('option')) {
                    label = 'オプション';
                } else {
                    label = 'ボタン';
                }
            }
            makeInteractive(btn, 'button', label);
        });

        // 5. Message list unread label & date headers (Heading level 2)
        const dateHeaders = document.querySelectorAll('.messageDate-module__date_wrap__I4ily');
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

        // 6. GNB (Global Navigation Bar) icons/tabs on the left (e.g. Chats, Friends)
        const gnbItems = document.querySelectorAll(
            '[class*="gnb"] button, [class*="gnb"] a, [class*="gnb"] li, [class*="gnb"] [class*="button"], [class*="gnb-module__nav_list_item"]'
        );
        gnbItems.forEach(item => {
            let label = item.getAttribute('aria-label') || item.title || item.textContent.trim();
            if (!label) {
                const classStr = item.className.toString();
                if (classStr.includes('friend')) label = '友だち一覧';
                else if (classStr.includes('chat')) label = 'トーク一覧';
                else if (classStr.includes('timeline') || classStr.includes('voom')) label = 'VOOM';
                else if (classStr.includes('keep')) label = 'Keep';
                else if (classStr.includes('setting')) label = '設定';
                else label = 'メニュー項目';
            }
            makeInteractive(item, 'tab', label);
        });

        // 7. Talkroom title header (H1)
        const chatHeader = document.querySelector('[class*="chatroomHeader-module__name__"]');
        if (chatHeader && chatHeader.getAttribute('role') !== 'heading') {
            chatHeader.setAttribute('role', 'heading');
            chatHeader.setAttribute('aria-level', '1');
            console.log("Applied H1 heading to chatroom title: " + chatHeader.textContent);
        }

        // 8. Remove list/listitem roles to prevent screen reader repeating the date header for each message
        const messageList = document.querySelector('.message_list');
        if (messageList) {
            messageList.removeAttribute('role');
        }
        
        const messages = document.querySelectorAll('.message_list [data-message-id]');
        messages.forEach(msg => {
            msg.removeAttribute('role');
            msg.removeAttribute('aria-level');
        });

        // 9. Input textarea accessibility label
        const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
        if (textarea && !textarea.getAttribute('aria-label')) {
            textarea.setAttribute('aria-label', 'メッセージを入力');
        }

        // 10. Editor buttons accessibility labels
        const editorButtons = document.querySelectorAll('[class*="chatroomEditor"] button, [class*="chatroomEditor"] [role="button"]');
        editorButtons.forEach(btn => {
            if (btn.getAttribute('aria-label')) return;
            const classStr = btn.className.toString().toLowerCase();
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

        // 11. Modal check
        checkModalRoot();
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

    const observer = new MutationObserver((mutations) => {
        const headerEl = document.querySelector('[class*="chatroomHeader-module__name__"]');
        const chatroomId = headerEl ? headerEl.textContent.trim() : null;

        if (chatroomId !== currentChatroomId) {
            currentChatroomId = chatroomId;
            isInitialLoading = true;
            if (initialLoadTimeout) clearTimeout(initialLoadTimeout);
            
            initialLoadTimeout = setTimeout(() => {
                isInitialLoading = false;
                const allMsgs = document.querySelectorAll('.message_list [data-message-id]');
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
                const allMessages = Array.from(document.querySelectorAll('.message_list [data-message-id]'));
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
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
