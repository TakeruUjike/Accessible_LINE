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

    // --- Keyboard Navigation Helpers ---
    let hasFocusedEditorForRoom = false;
    let isMentionListActive = false;

    function getAdjacentMessage(currentMsg, direction) {
        try {
            const messages = Array.from(document.querySelectorAll('.message_list [data-message-id], [class*="message_list"] [data-message-id]'));
            const index = messages.indexOf(currentMsg);
            if (index === -1) return null;
            const targetIndex = index + direction;
            if (targetIndex >= 0 && targetIndex < messages.length) {
                return messages[targetIndex];
            }
        } catch (e) {
            console.error("Accessibility Patch: getAdjacentMessage failed", e);
        }
        return null;
    }

    function getLeftSidebarLastElement() {
        try {
            const chatItems = Array.from(document.querySelectorAll('[class*="chatlistItem-module__chatlist_item__"]'));
            const friendItems = Array.from(document.querySelectorAll('[class*="friendlistItem-module__item__"]'));
            
            const visibleChatItems = chatItems.filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            const visibleFriendItems = friendItems.filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            
            if (visibleChatItems.length > 0) {
                const lastItem = visibleChatItems[visibleChatItems.length - 1];
                const clickBtn = lastItem.querySelector('button[class*="button_chatlist_item"], button, [tabindex="0"]');
                return clickBtn || lastItem;
            }
            
            if (visibleFriendItems.length > 0) {
                const lastItem = visibleFriendItems[visibleFriendItems.length - 1];
                const clickBtn = lastItem.querySelector('button[class*="button_friend"], button, [tabindex="0"]');
                return clickBtn || lastItem;
            }

            const tabs = Array.from(document.querySelectorAll('[class*="folderTab-module__tab_item__"]')).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            if (tabs.length > 0) {
                return tabs[tabs.length - 1];
            }
            
            const gnbItems = Array.from(document.querySelectorAll('[class*="gnb"] button, [class*="gnb"] a, [class*="gnb"] li [tabindex="0"]')).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            if (gnbItems.length > 0) {
                return gnbItems[gnbItems.length - 1];
            }
        } catch (e) {
            console.error("Accessibility Patch: getLeftSidebarLastElement failed", e);
        }
        return null;
    }

    function getMessageTextForLabel(msgEl) {
        if (!msgEl) return "";
        try {
            const classStr = msgEl.className ? msgEl.className.toString() : '';
            if (classStr.includes('systemMessage') || msgEl.querySelector('[class*="systemMessage"]')) {
                return msgEl.textContent.trim();
            }

            // Get the main layout container of the message
            const layoutEl = msgEl.closest('[class*="messageLayout-module__message__"]');
            
            let sender = "";
            let isMyMessage = false;

            if (layoutEl) {
                isMyMessage = layoutEl.getAttribute('data-direction') === 'reverse';
            } else {
                isMyMessage = msgEl.getAttribute('data-direction') === 'reverse' || 
                               msgEl.querySelector('[data-direction="reverse"]') ||
                               classStr.includes('reverse') || 
                               msgEl.querySelector('[class*="reverse"]') ||
                               msgEl.querySelector('[class*="my"], [class*="outgoing"]') || 
                               classStr.includes('my') || 
                               classStr.includes('outgoing');
            }

            if (isMyMessage) {
                sender = "自分";
            } else {
                let senderName = "";
                if (layoutEl) {
                    const primaryNameEl = layoutEl.querySelector('[class*="username-module__username__"]');
                    if (primaryNameEl) {
                        senderName = primaryNameEl.textContent.trim();
                    }
                    if (!senderName) {
                        const backupNameEl = layoutEl.querySelector('[class*="username"], [class*="name"], [class*="sender"], [class*="nickname"]');
                        if (backupNameEl) {
                            senderName = backupNameEl.textContent.trim();
                        }
                    }
                } else {
                    const backupNameEl = msgEl.querySelector('[class*="username-module__username__"], [class*="username"], [class*="name"], [class*="sender"], [class*="nickname"]');
                    if (backupNameEl) {
                        senderName = backupNameEl.textContent.trim();
                    }
                }
                sender = senderName || "相手";
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

            const timeEl = msgEl.querySelector('time, [class*="time"]') || (layoutEl ? layoutEl.querySelector('time, [class*="time"]') : null);
            const time = timeEl ? timeEl.textContent.trim() : "";
            
            return `${sender}: ${bodyText} ${time}`.trim();
        } catch (e) {
            console.error("Accessibility Patch: getMessageTextForLabel failed", e);
            return "";
        }
    }

    function focusMessageList() {
        try {
            const messages = Array.from(document.querySelectorAll('.message_list [data-message-id], [class*="message_list"] [data-message-id]'));
            if (messages.length === 0) return;

            let firstUnreadMsg = null;
            const messageListEl = document.querySelector('.message_list, [class*="message_list"]');
            if (messageListEl) {
                const unreadDividers = messageListEl.querySelectorAll('[class*="unread"], [class*="divider"], [class*="UnreadLine"]');
                let unreadDivider = null;
                for (const el of unreadDividers) {
                    const text = el.textContent || "";
                    if (text.includes("未読") || text.toLowerCase().includes("unread") || text.toLowerCase().includes("new message")) {
                        unreadDivider = el;
                        break;
                    }
                }
                
                if (unreadDivider) {
                    for (const msg of messages) {
                        if (unreadDivider.compareDocumentPosition(msg) & Node.DOCUMENT_POSITION_FOLLOWING) {
                            firstUnreadMsg = msg;
                            break;
                        }
                    }
                }
            }

            if (firstUnreadMsg) {
                firstUnreadMsg.setAttribute('tabindex', '-1');
                firstUnreadMsg.focus();
                announce("最初の未読メッセージにフォーカスしました");
                console.log("Focused first unread message.");
            } else {
                const latestMsg = messages[messages.length - 1];
                latestMsg.setAttribute('tabindex', '-1');
                latestMsg.focus();
                announce("最新のメッセージにフォーカスしました");
                console.log("Focused latest message.");
            }
        } catch (e) {
            console.error("Accessibility Patch: focusMessageList failed", e);
        }
    }

    // F6 / Shift+F6 ペイン循環切り替え機能 (Slack風)
    window.addEventListener('keydown', function(e) {
        if (e.key === 'F6') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const areas = {
                gnb: document.querySelector('#root > div > div > div.gnb-module__gnb__01tnB') || 
                     document.querySelector('[class*="gnb-module__gnb__"]') || 
                     document.querySelector('[class*="gnb"]'),
                left: document.querySelector('#root > div > div > div.chatlist-module__chatlist_wrap__KtTpq > div.chatlist-module__chatlist__qruAE > div > div > div > div') || 
                      document.querySelector('#root > div > div > div.friendlist-module__list_wrap__IeJXY > div.friendlist-module__list__Z-8nt > div > div > div > div') || 
                      document.querySelector('[class*="chatlist-module__chatlist_wrap__"]') || 
                      document.querySelector('[class*="chatlist-module__chatlist__"]') || 
                      document.querySelector('[class*="chatlist"]') || 
                      document.querySelector('[class*="friendlist-module__list_wrap__"]') || 
                      document.querySelector('[class*="friendlist-module__list__"]') || 
                      document.querySelector('[class*="friendlist"]'),
                right: document.querySelector('#root > div > div > div.chatroom-module__chatroom__eVUaK') || 
                       document.querySelector('[class*="chatroom-module__chatroom__"]') || 
                       document.querySelector('[class*="chatroom"]')
            };

            const activeEl = document.activeElement;

            // 現在アクティブな要素がどのエリアに属しているかを判定
            let currentAreaIndex = -1; // -1: 不明, 0: GNB, 1: Left, 2: Right
            if (activeEl) {
                if (areas.gnb && (areas.gnb === activeEl || areas.gnb.contains(activeEl))) {
                    currentAreaIndex = 0;
                } else if (areas.left && (areas.left === activeEl || areas.left.contains(activeEl))) {
                    currentAreaIndex = 1;
                } else if (areas.right && (areas.right === activeEl || areas.right.contains(activeEl))) {
                    currentAreaIndex = 2;
                }
            }

            // 次のエリアの決定 (F6: 正順, Shift+F6: 逆順)
            const direction = e.shiftKey ? -1 : 1;
            let nextAreaIndex;
            if (currentAreaIndex === -1) {
                nextAreaIndex = e.shiftKey ? 2 : 0;
            } else {
                nextAreaIndex = (currentAreaIndex + direction + 3) % 3;
            }

            // 移動先のエリアに応じた処理
            let targetArea = null;
            let announceMsg = "";
            let focusTarget = null;

            if (nextAreaIndex === 0) {
                targetArea = areas.gnb;
                announceMsg = "グローバルバー";
                if (targetArea) {
                    focusTarget = targetArea.querySelector('button, a, [tabindex="0"]');
                }
            } else if (nextAreaIndex === 1) {
                targetArea = areas.left;
                announceMsg = "左側リスト";
                if (targetArea) {
                    focusTarget = targetArea.querySelector('[class*="folderTab-module__tab_item__"].active, [class*="folderTab-module__tab_item__"], [class*="chatlistItem-module__chatlist_item__"], [class*="friendlistItem-module__item__"], button, [tabindex="0"]');
                }
            } else if (nextAreaIndex === 2) {
                targetArea = areas.right;
                announceMsg = "右側トークルーム";
                if (targetArea) {
                    focusTarget = targetArea.querySelector('[class*="chatroomEditor-module__textarea__"], textarea, .message_list, [class*="message_list"]');
                }
            }

            // ターゲットが見つかった場合のフォーカス処理
            if (!focusTarget && targetArea) {
                focusTarget = targetArea;
            }

            if (focusTarget) {
                if (!focusTarget.hasAttribute('tabindex')) {
                    focusTarget.setAttribute('tabindex', '-1');
                }
                focusTarget.focus();
                announce(announceMsg + "にフォーカスしました");
                console.log(`F6 navigation: focused ${announceMsg}.`, focusTarget);
            } else {
                announce(announceMsg + "が見つかりませんでした");
                console.log(`F6 navigation: target area ${announceMsg} not found.`);
            }
        }
    }, true);

    // チャットリスト/友だちリスト内での上下矢印キーでの移動とEnterキーでの決定処理 (NVDAフォーカスモード用)
    window.addEventListener('keydown', function(e) {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const chatItem = activeEl.closest('[class*="chatlistItem-module__chatlist_item__"]');
        const friendItem = activeEl.closest('[class*="friendlistItem-module__item__"]');
        const currentItem = chatItem || friendItem;

        if (!currentItem) return;

        // 左側リストのコンテナを取得
        const leftContainer = currentItem.closest('[class*="chatlist-module__chatlist__"]') || 
                              currentItem.closest('[class*="friendlist-module__list__"]') ||
                              document.querySelector('#root > div > div > div.chatlist-module__chatlist_wrap__KtTpq > div.chatlist-module__chatlist__qruAE > div > div > div > div') ||
                              document.querySelector('#root > div > div > div.friendlist-module__list_wrap__IeJXY > div.friendlist-module__list__Z-8nt > div > div > div > div');

        if (!leftContainer) return;

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();

            // リスト内のすべての項目を取得
            const items = Array.from(leftContainer.querySelectorAll('[class*="chatlistItem-module__chatlist_item__"], [class*="friendlistItem-module__item__"]'));
            const index = items.indexOf(currentItem);
            if (index === -1) return;

            const direction = e.key === 'ArrowUp' ? -1 : 1;
            const targetIndex = index + direction;

            if (targetIndex >= 0 && targetIndex < items.length) {
                const nextItem = items[targetIndex];
                
                // トークルーム項目内のメインボタンから詳細な aria-label（名前、未読、最新メッセージ、時間など）を取得
                const mainBtn = nextItem.querySelector('button[class*="button_chatlist_item"], button[class*="button_friend"], button');
                const detailLabel = (mainBtn ? mainBtn.getAttribute('aria-label') : null) || nextItem.getAttribute('aria-label') || nextItem.textContent || "不明な項目";

                // 親アイテム自体をフォーカス可能にし、余計なコントロール名（ボタン等）を読ませない設定にする
                nextItem.setAttribute('tabindex', '-1');
                nextItem.setAttribute('aria-label', detailLabel);
                nextItem.setAttribute('role', 'text'); // ボタンなどのコントロールタイプとしての読み上げを抑制
                
                nextItem.focus();
                
                // スクリーンリーダーに詳細情報を即時かつ強制的に読み上げさせる
                announce(detailLabel, true);
            }
        }

        if (e.key === 'Enter' || e.key === ' ') {
            let clickBtn = currentItem.querySelector('button[class*="button_chatlist_item"], button[class*="button_friend"]');
            if (!clickBtn) {
                const buttons = Array.from(currentItem.querySelectorAll('button, a, [tabindex="0"]'));
                clickBtn = buttons.find(btn => {
                    const isInsideProfile = btn.closest('[class*="profileImage-module__"]') || 
                                            btn.closest('[class*="thumbnail"]') || 
                                            btn.closest('[class*="avatar"]');
                    return !isInsideProfile;
                });
            }

            if (clickBtn && clickBtn !== activeEl) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                simulateClick(clickBtn);
            } else {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                simulateClick(activeEl);
            }
        }
    }, true);

    // トークルーム内でEscが押された際、公式のクローズ処理後に左側リスト（トークルーム一覧）にフォーカスを戻す処理
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const activeEl = document.activeElement;
            if (!activeEl) return;

            const rightArea = document.querySelector('#root > div > div > div.chatroom-module__chatroom__eVUaK') || 
                               document.querySelector('[class*="chatroom-module__chatroom__"]') || 
                               document.querySelector('[class*="chatroom"]');

            if (rightArea && (rightArea === activeEl || rightArea.contains(activeEl))) {
                // 公式のEscキー処理が走るのを待つため、少し遅延を入れてフォーカスを移動する
                setTimeout(() => {
                    const leftArea = document.querySelector('#root > div > div > div.chatlist-module__chatlist_wrap__KtTpq > div.chatlist-module__chatlist__qruAE > div > div > div > div') || 
                                     document.querySelector('#root > div > div > div.friendlist-module__list_wrap__IeJXY > div.friendlist-module__list__Z-8nt > div > div > div > div') || 
                                     document.querySelector('[class*="chatlist-module__chatlist_wrap__"]') || 
                                     document.querySelector('[class*="chatlist-module__chatlist__"]') || 
                                     document.querySelector('[class*="chatlist"]') || 
                                     document.querySelector('[class*="friendlist-module__list_wrap__"]') || 
                                     document.querySelector('[class*="friendlist-module__list__"]') || 
                                     document.querySelector('[class*="friendlist"]');

                    if (leftArea) {
                        const focusTarget = leftArea.querySelector('[class*="folderTab-module__tab_item__"].active, [class*="folderTab-module__tab_item__"], [class*="chatlistItem-module__chatlist_item__"], [class*="friendlistItem-module__item__"], button, [tabindex="0"]') || leftArea;
                        
                        if (focusTarget) {
                            if (!focusTarget.hasAttribute('tabindex')) {
                                focusTarget.setAttribute('tabindex', '-1');
                            }
                            focusTarget.focus();
                            announce("トークルームを閉じ、左側リストにフォーカスしました");
                            console.log("Escape key: focused left sidebar.");
                        }
                    }
                }, 120);
            }
        }
    }, true);

    // Global Event Listeners to block LINE official shortcuts when focusing on messages
    window.addEventListener('keydown', function(e) {
        const activeEl = document.activeElement;
        if (!activeEl) return;
        
        const msg = activeEl.closest('.message_list [data-message-id], [class*="message_list"] [data-message-id]');
        if (!msg) return;
        
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
            if (e.key === 'Tab' && e.shiftKey) {
                const leftSidebarTarget = getLeftSidebarLastElement();
                if (leftSidebarTarget) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    leftSidebarTarget.focus();
                    announce("左側のリストの最後にフォーカスしました");
                    console.log("Shift+Tab captured: focused left sidebar target.");
                }
                return;
            }
            
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            
            if (e.key === 'ArrowUp') {
                const prevMsg = getAdjacentMessage(msg, -1);
                if (prevMsg) prevMsg.focus();
            } else if (e.key === 'ArrowDown') {
                const nextMsg = getAdjacentMessage(msg, 1);
                if (nextMsg) {
                    nextMsg.focus();
                } else {
                    const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
                    if (textarea) textarea.focus();
                }
            } else if (e.key === 'Tab') {
                const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
                if (textarea) textarea.focus();
            }
        }
    }, true); // Capture phase to intercept global listeners

    // Force focus navigation for editor buttons to bypass official LINE focus traps/blocks
    window.addEventListener('keydown', function(e) {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const editorBtn = activeEl.closest('[class*="chatroomEditor"] button, [class*="chatroomEditor"] [role="button"]');
        if (editorBtn && e.key === 'Tab') {
            try {
                const editorButtons = Array.from(document.querySelectorAll('[class*="chatroomEditor"] button, [class*="chatroomEditor"] [role="button"]'))
                    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
                
                const index = editorButtons.indexOf(editorBtn);
                if (index !== -1) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();

                    if (e.shiftKey) {
                        if (index === 0) {
                            const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
                            if (textarea) textarea.focus();
                        } else {
                            editorButtons[index - 1].focus();
                        }
                    } else {
                        if (index === editorButtons.length - 1) {
                            focusMessageList();
                        } else {
                            editorButtons[index + 1].focus();
                        }
                    }
                }
            } catch (err) {
                console.error("Accessibility Patch: Editor button tab bypass failed", err);
            }
        }
    }, true);

    // Keyboard navigation and announcements for Mention Suggestion List (Combobox & Assertive Live Region)
    window.addEventListener('keydown', function(e) {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const isTextarea = activeEl.className.includes('chatroomEditor') || 
                           activeEl.closest('[class*="chatroomEditor-module__textarea__"]');
        const mentionList = document.querySelector('[class*="mentionSuggestion-module__suggestion_list__"]');

        if (isTextarea && mentionList) {
            // 上下矢印キーが押されたとき
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                // ブラウザのデフォルトのカーソル移動挙動（スクリーンリーダーの自動読み上げのトリガー）をブロックする！
                e.preventDefault();

                setTimeout(() => {
                    const selectedEl = mentionList.querySelector('[aria-selected="true"]');
                    if (selectedEl) {
                        // その場で一意のIDを付与する（Reactの再描画によるID消失対策）
                        const itemId = 'accessible-selected-mention-item';
                        if (selectedEl.id !== itemId) {
                            selectedEl.id = itemId;
                        }
                        activeEl.setAttribute('aria-activedescendant', itemId);
                        
                        // 強制割り込み（assertive）で名前を読み上げる
                        const infoEl = selectedEl.querySelector('[class*="suggestion_item_info"]') || selectedEl.querySelector('.suggestion_item_info') || selectedEl;
                        const name = infoEl.textContent.trim();
                        announce(`選択: ${name}`, true); // "選択: 山田太郎" のように明示的に読み上げる
                    }
                }, 80); // ReactのDOM更新後に確実に実行するために80ms待つ
            }
        }
    }, true); // Capture phase to monitor and conditionally preventDefault keydown events

    // Keep track of the last announced cursor position inside the mention to prevent repeat announcements
    let lastAnnouncedPos = -1;
    let lastSelectionStart = -1;
    let selectionChangeCount = 0;
    let keyEventCount = 0;

    // Helper to check mention under the cursor and announce it
    function checkMentionCursor(activeEl) {
        try {
            if (!activeEl) return;
            const className = getSafeClassName(activeEl);
            
            // Check if active element is the chatroom textarea (contenteditable or Shadow Host/textarea-ex)
            const isTextarea = className.includes('chatroomEditor') || 
                               activeEl.closest('[class*="chatroomEditor-module__textarea__"]') ||
                               activeEl.tagName === 'TEXTAREA-EX';
                                
            if (!isTextarea) {
                lastAnnouncedPos = -1;
                lastSelectionStart = -1;
                return;
            }
            
            let textarea = null;
            if (activeEl.shadowRoot) {
                textarea = activeEl.shadowRoot.querySelector('textarea');
            }
            if (!textarea && activeEl.tagName === 'TEXTAREA') {
                textarea = activeEl;
            }
            
            if (!textarea) {
                lastAnnouncedPos = -1;
                lastSelectionStart = -1;
                return;
            }
            
            const pos = textarea.selectionStart;
            const rawValue = activeEl.rawValue;
            const pool = activeEl._characterPool;

            const useProprietary = rawValue && typeof rawValue === 'string' && pool && typeof pool.getBlock === 'function';

            if (useProprietary) {
                const prevPos = lastSelectionStart;
                lastSelectionStart = pos;

                // Check only the character directly under/after the cursor (at index pos)
                // This represents the character the cursor is currently "on" (to the right of the cursor)
                const indices = [pos];
                
                let mentionBlock = null;
                let mentionIndex = -1;
                
                for (const idx of indices) {
                    if (idx >= 0 && idx < rawValue.length) {
                        const char = rawValue[idx];
                        const block = pool.getBlock(char);
                        if (block && (block.type === 'mention' || block.part === 'mention' || (block.part && block.part.includes('mention')))) {
                            mentionBlock = block;
                            mentionIndex = idx; // Store the exact index of this PUA block char in rawValue
                            break;
                        }
                    }
                }
                
                if (mentionBlock) {
                    // Announce if the cursor position (pos) has changed
                    if (lastAnnouncedPos !== pos) {
                        lastAnnouncedPos = pos;
                        const name = mentionBlock.altText || mentionBlock.text || "相手";
                        if (name) {
                            const cleanName = name.startsWith('@') ? name : '@' + name;
                            announce(`メンション: ${cleanName.trim()}`, true); // Speak assertively
                        }
                    }
                } else {
                    lastAnnouncedPos = -1;
                }
            } else {
                // Fallback string-based mention detection if proprietary API is missing
                const textValue = textarea.value || activeEl.value || activeEl.textContent || "";
                const prevPos = lastSelectionStart;
                lastSelectionStart = pos;

                // Find all potential mentions in the text (e.g., @Name)
                const mentionRegex = /@[^\s@]+/g;
                let match;
                let currentMention = null;

                while ((match = mentionRegex.exec(textValue)) !== null) {
                    const start = match.index;
                    const end = match.index + match[0].length;
                    // Check if cursor is on/inside the mention (from @ up to the end of the mention text)
                    if (pos >= start && pos <= end) {
                        currentMention = match[0];
                        break;
                    }
                }

                if (currentMention) {
                    if (lastAnnouncedPos !== pos) {
                        lastAnnouncedPos = pos;
                        announce(`メンション: ${currentMention.trim()}`, true);
                    }
                } else {
                    lastAnnouncedPos = -1;
                }
            }
        } catch (e) {
            console.error("Accessibility Patch: checkMentionCursor error", e);
        }
    }

    // Handle cursor movement inside message editor (selectionchange event)
    document.addEventListener('selectionchange', function() {
        selectionChangeCount++;
        const activeEl = document.activeElement;
        checkMentionCursor(activeEl);
    });

    // Fallback: Handle cursor movement via Arrow keys (keyup/keydown event inside editor)
    window.addEventListener('keyup', function(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
            keyEventCount++;
            const activeEl = document.activeElement;
            // Introduce a tiny delay to ensure textarea.selectionStart has updated
            setTimeout(() => {
                checkMentionCursor(activeEl);
            }, 10);
        }
    }, true);

    window.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
            keyEventCount++;
            const activeEl = document.activeElement;
            setTimeout(() => {
                checkMentionCursor(activeEl);
            }, 10);
        }
    }, true);


    function preventGlobalShortcuts(e) {
        const activeEl = document.activeElement;
        if (!activeEl) return;
        const msg = activeEl.closest('.message_list [data-message-id], [class*="message_list"] [data-message-id]');
        if (!msg) return;
        
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
    window.addEventListener('keyup', preventGlobalShortcuts, true);
    window.addEventListener('keypress', preventGlobalShortcuts, true);

    // 1. Announcer region for Screen Readers (Live Region) - Safely deferred
    let announcer = null;
    let announcerAssertive = null;
    let announceTimeoutPolite = null;
    let announceTimeoutAssertive = null;

    function applyAnnouncerStyles(el) {
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.padding = '0';
        el.style.margin = '-1px';
        el.style.overflow = 'hidden';
        el.style.clip = 'rect(0, 0, 0, 0)';
        el.style.border = '0';
    }

    function initAnnouncer() {
        if (announcer && announcerAssertive) return;
        try {
            if (!announcer) {
                announcer = document.getElementById('sr-announcer');
                if (!announcer && document.body) {
                    announcer = document.createElement('div');
                    announcer.id = 'sr-announcer';
                    announcer.setAttribute('aria-live', 'polite');
                    announcer.setAttribute('aria-atomic', 'true');
                    applyAnnouncerStyles(announcer);
                    document.body.appendChild(announcer);
                    console.log("Accessibility Announcer initialized.");
                }
            }
            if (!announcerAssertive) {
                announcerAssertive = document.getElementById('sr-announcer-assertive');
                if (!announcerAssertive && document.body) {
                    announcerAssertive = document.createElement('div');
                    announcerAssertive.id = 'sr-announcer-assertive';
                    announcerAssertive.setAttribute('aria-live', 'assertive');
                    announcerAssertive.setAttribute('aria-atomic', 'true');
                    applyAnnouncerStyles(announcerAssertive);
                    document.body.appendChild(announcerAssertive);
                    console.log("Assertive Accessibility Announcer initialized.");
                }
            }
        } catch (e) {
            console.error("Accessibility Patch: Failed to initialize announcer", e);
        }
    }

    let announceToggle = false;
    function announce(message, isAssertive = false) {
        initAnnouncer();
        const target = isAssertive ? announcerAssertive : announcer;
        if (target) {
            // 末尾に不可視のゼロ幅スペースを交互に付与して、毎回必ずDOMテキストが変化したとブラウザに認識させる
            announceToggle = !announceToggle;
            const tweakedMessage = message + (announceToggle ? "\u200B" : "");

            if (isAssertive) {
                if (announceTimeoutAssertive) clearTimeout(announceTimeoutAssertive);
                target.textContent = '';
                announceTimeoutAssertive = setTimeout(() => {
                    target.textContent = tweakedMessage;
                }, 50); // 50msの隙間を開けてスクリーンリーダーに変更を強制通知
            } else {
                if (announceTimeoutPolite) clearTimeout(announceTimeoutPolite);
                target.textContent = '';
                announceTimeoutPolite = setTimeout(() => {
                    target.textContent = tweakedMessage;
                }, 50);
            }
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

    function isElementVisible(el) {
        if (!el) return false;
        try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function checkModalRoot() {
        try {
            const modalRoot = document.getElementById('modal-root');
            if (!modalRoot) return;

            let modal = null;
            for (const child of modalRoot.children) {
                if (isElementVisible(child)) {
                    modal = child;
                    break;
                }
            }

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
                if (activeModal.dataset.focusTrapAttached) {
                    activeModal.removeEventListener('keydown', handleModalKeyDown);
                    delete activeModal.dataset.focusTrapAttached;
                }
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
                if (modalFocusElements.length <= 1) return; // Safe: don't trap if there is 1 or 0 focusable elements

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

            // Get the main layout container of the message
            const layoutEl = msgEl.closest('[class*="messageLayout-module__message__"]');
            
            let sender = "";
            let isMyMessage = false;

            if (layoutEl) {
                isMyMessage = layoutEl.getAttribute('data-direction') === 'reverse';
            } else {
                isMyMessage = msgEl.getAttribute('data-direction') === 'reverse' || 
                               msgEl.querySelector('[data-direction="reverse"]') ||
                               classStr.includes('reverse') || 
                               msgEl.querySelector('[class*="reverse"]') ||
                               msgEl.querySelector('[class*="my"], [class*="outgoing"]') || 
                               classStr.includes('my') || 
                               classStr.includes('outgoing');
            }

            if (isMyMessage) {
                sender = "自分";
            } else {
                let senderName = "";
                if (layoutEl) {
                    const primaryNameEl = layoutEl.querySelector('[class*="username-module__username__"]');
                    if (primaryNameEl) {
                        senderName = primaryNameEl.textContent.trim();
                    }
                    if (!senderName) {
                        const backupNameEl = layoutEl.querySelector('[class*="username"], [class*="name"], [class*="sender"], [class*="nickname"]');
                        if (backupNameEl) {
                            senderName = backupNameEl.textContent.trim();
                        }
                    }
                } else {
                    const backupNameEl = msgEl.querySelector('[class*="username-module__username__"], [class*="username"], [class*="name"], [class*="sender"], [class*="nickname"]');
                    if (backupNameEl) {
                        senderName = backupNameEl.textContent.trim();
                    }
                }
                sender = senderName || "相手";
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
            const leftContainer = document.querySelector('#root > div > div > div.chatlist-module__chatlist_wrap__KtTpq > div.chatlist-module__chatlist__qruAE > div > div > div > div') || 
                                  document.querySelector('#root > div > div > div.friendlist-module__list_wrap__IeJXY > div.friendlist-module__list__Z-8nt > div > div > div > div') || 
                                  document.querySelector('[class*="chatlist-module__chatlist_wrap__"]') || 
                                  document.querySelector('[class*="chatlist-module__chatlist__"]') || 
                                  document.querySelector('[class*="chatlist"]') || 
                                  document.querySelector('[class*="friendlist-module__list_wrap__"]') || 
                                  document.querySelector('[class*="friendlist-module__list__"]') || 
                                  document.querySelector('[class*="friendlist"]');
            if (leftContainer) {
                leftContainer.setAttribute('aria-label', '左側リスト');
                // ユーザーの要望により、NVDAがフォーカスモードに入るよう role="application" を設定
                leftContainer.setAttribute('role', 'application');
            }

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
            const gnbContainer = document.querySelector('#root > div > div > div.gnb-module__gnb__01tnB') || 
                                 document.querySelector('[class*="gnb-module__gnb__"]') || 
                                 document.querySelector('[class*="gnb"]');
            if (gnbContainer) {
                gnbContainer.setAttribute('aria-label', 'グローバルバー');
                if (!gnbContainer.getAttribute('role')) {
                    gnbContainer.setAttribute('role', 'navigation');
                }
            }

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

        // 7. Talkroom title header (H1) and chatroom container - Hash-independent
        try {
            const chatHeader = document.querySelector('[class*="chatroomHeader-module__name__"]');
            if (chatHeader && chatHeader.getAttribute('role') !== 'heading') {
                chatHeader.setAttribute('role', 'heading');
                chatHeader.setAttribute('aria-level', '1');
                console.log("Applied H1 heading to chatroom title: " + chatHeader.textContent);
            }

            const rightContainer = document.querySelector('#root > div > div > div.chatroom-module__chatroom__eVUaK') || 
                                   document.querySelector('[class*="chatroom-module__chatroom__"]') || 
                                   document.querySelector('[class*="chatroom"]');
            if (rightContainer) {
                rightContainer.setAttribute('aria-label', '右側トークルーム');
                if (!rightContainer.getAttribute('role')) {
                    rightContainer.setAttribute('role', 'region');
                }
            }
        } catch (e) { console.error("Patch Error (ChatroomHeader):", e); }

        // 8. Apply application role to message list container to maintain NVDA focus mode, and set aria-labels
        try {
            const messageList = document.querySelector('.message_list') || document.querySelector('[class*="message_list"]');
            if (messageList) {
                if (messageList.getAttribute('role') !== 'application') {
                    messageList.setAttribute('role', 'application');
                    messageList.setAttribute('aria-label', 'メッセージ履歴');
                }
            }
            
            const messages = document.querySelectorAll('.message_list [data-message-id]') || 
                             document.querySelectorAll('[class*="message_list"] [data-message-id]');
            messages.forEach(msg => {
                msg.removeAttribute('role');
                msg.removeAttribute('aria-level');
                
                // Set custom accessible label: "Sender: Message Time"
                const readLabel = getMessageTextForLabel(msg);
                if (readLabel && msg.getAttribute('aria-label') !== readLabel) {
                    msg.setAttribute('aria-label', readLabel);
                }
                
                if (!msg.hasAttribute('tabindex')) {
                    msg.setAttribute('tabindex', '-1');
                }
            });
        } catch (e) { console.error("Patch Error (MessageRoles):", e); }

        // 9. Input textarea accessibility label, Shift+Tab handler, and automatic focus
        try {
            const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
            if (textarea) {
                if (!textarea.getAttribute('aria-label')) {
                    textarea.setAttribute('aria-label', 'メッセージを入力');
                }
                if (!textarea.dataset.shiftTabHandlerAttached) {
                    textarea.addEventListener('keydown', function(e) {
                        if (e.key === 'Tab' && e.shiftKey) {
                            e.preventDefault();
                            focusMessageList();
                        }
                    });
                    textarea.dataset.shiftTabHandlerAttached = 'true';
                }
                if (!hasFocusedEditorForRoom) {
                    textarea.focus();
                    hasFocusedEditorForRoom = true;
                    console.log("Automatically focused message textarea via patchDOM.");
                }
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

        // 12. Mention suggestion list accessibility (WAI-ARIA Combobox Pattern)
        try {
            const mentionList = document.querySelector('[class*="mentionSuggestion-module__suggestion_list__"]');
            const textarea = document.querySelector('[class*="chatroomEditor-module__textarea__"]');
            
            if (mentionList && textarea) {
                // 1. リスト本体の設定
                if (!mentionList.id) {
                    mentionList.id = 'accessible-mention-list';
                }
                if (mentionList.getAttribute('role') !== 'listbox') {
                    mentionList.setAttribute('role', 'listbox');
                }

                // 2. 入力欄の設定
                if (textarea.getAttribute('role') !== 'combobox') {
                    textarea.setAttribute('role', 'combobox');
                    textarea.setAttribute('aria-autocomplete', 'list');
                    textarea.setAttribute('aria-haspopup', 'listbox');
                    textarea.setAttribute('aria-controls', 'accessible-mention-list');
                    textarea.setAttribute('aria-expanded', 'true');
                }

                // 3. 各リストアイテムの設定
                const items = mentionList.querySelectorAll('[class*="mentionSuggestion-module__suggestion_list_item__"]');
                items.forEach((item, index) => {
                    if (item.getAttribute('role') !== 'option') {
                        item.setAttribute('role', 'option');
                    }
                    const itemId = `accessible-mention-item-${index}`;
                    if (item.id !== itemId) {
                        item.id = itemId;
                    }
                    
                    if (!item.getAttribute('aria-label')) {
                        const infoEl = item.querySelector('[class*="suggestion_item_info"]') || item.querySelector('.suggestion_item_info') || item;
                        const name = infoEl.textContent.trim();
                        item.setAttribute('aria-label', name);
                    }
                });

                if (!isMentionListActive) {
                    isMentionListActive = true;
                    announce("メンション候補が表示されました。上下矢印キーで選択できます。");
                }
            } else {
                if (isMentionListActive) {
                    isMentionListActive = false;
                    if (textarea) {
                        textarea.removeAttribute('aria-activedescendant');
                        textarea.setAttribute('aria-expanded', 'false');
                    }
                }
            }
        } catch (e) {
            console.error("Patch Error (MentionList):", e);
        }
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
                    hasFocusedEditorForRoom = false; // Reset focus flag for the new room
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
