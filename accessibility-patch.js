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

        // Add aria-label if specified and not present
        if (label && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
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

    // Main patch function called on DOM load and DOM changes
    function patchDOM() {
        // 1. Tabs (folderTab - "すべて", "グループ", "公式アカウント" など)
        const tabs = document.querySelectorAll('.folderTab-module__tab_item__7dbuI');
        tabs.forEach(tab => {
            const name = tab.textContent || 'タブ';
            makeInteractive(tab, 'tab', name);
            // Sync aria-selected with active tab state
            const isSelected = tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';
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

        // 5. Message list unread label & date headers
        const dateHeaders = document.querySelectorAll('.messageDate-module__date_wrap__I4ily');
        dateHeaders.forEach(header => {
            if (!header.hasAttribute('role')) {
                header.setAttribute('role', 'separator');
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
        const chatHeader = document.querySelector('.chatroomHeader-module__name__t-K11');
        if (chatHeader && chatHeader.getAttribute('role') !== 'heading') {
            chatHeader.setAttribute('role', 'heading');
            chatHeader.setAttribute('aria-level', '1');
            console.log("Applied H1 heading to chatroom title: " + chatHeader.textContent);
        }

        // 8. Talkroom message headings (H2 for all messages to ensure stability)
        const messages = document.querySelectorAll('.message_list [data-message-id]');
        messages.forEach(msg => {
            if (msg.getAttribute('role') === 'heading') return;
            msg.setAttribute('role', 'heading');
            msg.setAttribute('aria-level', '2');
        });
    }

    // Run patch on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchDOM);
    } else {
        patchDOM();
    }

    // Monitor DOM mutations to patch newly loaded items dynamically
    const observer = new MutationObserver((mutations) => {
        let shouldPatch = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldPatch = true;
                break;
            }
        }
        if (shouldPatch) {
            patchDOM();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
