(function() {
  let mutedUsers = [];

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getCurrentUser') {
      const userId = getCurrentUserIdFromPage();
      sendResponse({userId: userId});
    } else if (request.action === 'updateMutedUsers') {
      mutedUsers = request.mutedUsers;
      hideItemsFromMutedUsers();
      updateMuteButtons();
    }
  });

  async function init() {
    try {
      const result = await chrome.storage.sync.get(['mutedUsers']);
      mutedUsers = result.mutedUsers || [];
      
      if (Array.isArray(mutedUsers) && typeof mutedUsers[0] === 'string') {
        mutedUsers = mutedUsers.map(id => ({ userId: id, userInfo: '' }));
        await chrome.storage.sync.set({mutedUsers: mutedUsers});
      }
      
      loadFontAwesome();
      addMuteButtonStyles();
      hideItemsFromMutedUsers();
      addMuteButtons();
      addMutedIndicatorToProfile();
      startObserver();
    } catch (error) {
      console.error('Error initializing content script:', error);
    }
  }

  function getHideLevels() {
    const path = window.location.pathname;
    
    if (path === '/') {
      return 3;
    } else if (path.startsWith('/tags')) {
      return 3;
    } else if (path === '/ranking.php') {
      return 1;
    } else {
      return 3;
    }
  }

  function loadFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  function addMuteButtonStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .pixiv-mute-btn {
        margin-left: 8px;
        padding: 4px 6px;
        font-size: 12px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: #f5f5f5;
        color: #333;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
        line-height: 1;
        vertical-align: middle;
      }
      .pixiv-mute-btn:hover {
        background: #e0e0e0;
      }
      .pixiv-mute-btn.muted {
        background: #ffebee;
        border-color: #f44336;
        color: #d32f2f;
      }
      .pixiv-mute-btn.muted:hover {
        background: #ffcdd2;
      }
      .pixiv-muted-indicator {
        display: inline-block;
        background: #ffebee;
        border: 1px solid #f44336;
        color: #d32f2f;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        margin-left: 10px;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentUserIdFromPage() {
    const url = window.location.href;
    
    const userMatch = url.match(/\/users\/(\d+)/);
    if (userMatch) {
      return userMatch[1];
    }
    
    const userLink = document.querySelector('a[href*="/users/"]');
    if (userLink) {
      const userIdMatch = userLink.href.match(/\/users\/(\d+)/);
      if (userIdMatch) {
        return userIdMatch[1];
      }
    }
    
    return null;
  }

  function getParentElement(element, levels) {
    let parent = element;
    for (let i = 0; i < levels && parent && parent.parentElement; i++) {
      parent = parent.parentElement;
    }
    return parent;
  }

  function isImageOnlyLink(link) {
    return link.querySelector('img') !== null;
  }

  function getUserNameFromElement(element, userId) {
    let userName = '';
    
    const textContent = element.textContent.trim();
    if (textContent && !textContent.includes('http') && textContent.length < 50) {
      userName = textContent;
    }
    
    if (!userName) {
      const nearbyElements = element.parentElement.querySelectorAll('*');
      for (const el of nearbyElements) {
        const text = el.textContent.trim();
        if (text && text.length > 0 && text.length < 50 && !text.includes('http') && !text.match(/^\d+$/)) {
          userName = text;
          break;
        }
      }
    }
    
    return userName || `ユーザー${userId}`;
  }

  function addMuteButtons() {
    const targetSelectors = [
      '.sc-4fe4819c-2.OvXma:not([data-mute-button-added])',
      '.ui-profile-popup:not([data-mute-button-added])'
    ];
    
    targetSelectors.forEach(selector => {
      const targetElements = document.querySelectorAll(selector);
      
      targetElements.forEach(element => {
        const userLink = element.querySelector('a[href*="/users/"]') || 
                        element.closest('*').querySelector('a[href*="/users/"]') ||
                        element.parentElement.querySelector('a[href*="/users/"]');
        
        if (userLink) {
          const userIdMatch = userLink.href.match(/\/users\/(\d+)/);
          if (userIdMatch) {
            const userId = userIdMatch[1];
            
            const isMuted = mutedUsers.some(user => user.userId === userId);
            const button = document.createElement('span');
            button.className = `pixiv-mute-btn ${isMuted ? 'muted' : ''}`;
            button.innerHTML = isMuted ? 
              '<i class="fas fa-volume-up"></i>' : 
              '<i class="fas fa-volume-mute"></i>';
            button.title = isMuted ? `ユーザー${userId}のミュートを解除` : `ユーザー${userId}をミュート`;
            
            button.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const userName = getUserNameFromElement(element, userId);
              toggleMute(userId, userName);
            });
            
            element.parentNode.insertBefore(button, element.nextSibling);
            element.setAttribute('data-mute-button-added', 'true');
          }
        }
      });
    });
  }

  function updateMuteButtons() {
    const buttons = document.querySelectorAll('.pixiv-mute-btn');
    buttons.forEach(button => {
      const link = button.previousSibling;
      if (link && link.href) {
        const userIdMatch = link.href.match(/\/users\/(\d+)/);
        if (userIdMatch) {
          const userId = userIdMatch[1];
          const isMuted = mutedUsers.some(user => user.userId === userId);
          
          button.className = `pixiv-mute-btn ${isMuted ? 'muted' : ''}`;
          button.innerHTML = isMuted ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
          button.title = isMuted ? `ユーザー${userId}のミュートを解除` : `ユーザー${userId}をミュート`;
        }
      }
    });
  }

  async function toggleMute(userId, userName = '') {
    try {
      const result = await chrome.storage.sync.get(['mutedUsers']);
      let currentMutedUsers = result.mutedUsers || [];
      
      if (Array.isArray(currentMutedUsers) && typeof currentMutedUsers[0] === 'string') {
        currentMutedUsers = currentMutedUsers.map(id => ({ userId: id, userInfo: '' }));
      }
      
      const existingUserIndex = currentMutedUsers.findIndex(user => user.userId === userId);
      
      if (existingUserIndex !== -1) {
        currentMutedUsers.splice(existingUserIndex, 1);
        console.log('Unmuted user:', userId);
      } else {
        currentMutedUsers.push({ userId: userId, userInfo: userName });
        console.log('Muted user:', userId, 'with name:', userName);
      }
      
      await chrome.storage.sync.set({mutedUsers: currentMutedUsers});
      mutedUsers = currentMutedUsers;
      
      hideItemsFromMutedUsers();
      updateMuteButtons();
      
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }

  function hideItemsFromMutedUsers() {
    if (mutedUsers.length === 0) return;

    const hideLevels = getHideLevels();
    const userLinks = document.querySelectorAll('a[href*="/users/"]');
    const mutedUserIds = mutedUsers.map(user => user.userId);
    
    userLinks.forEach(link => {
      const userIdMatch = link.href.match(/\/users\/(\d+)/);
      if (userIdMatch && mutedUserIds.includes(userIdMatch[1])) {
        
        const targetElement = getParentElement(link, hideLevels);
        
        if (targetElement && !targetElement.classList.contains('pixiv-user-muted')) {
          targetElement.style.display = 'none';
          targetElement.classList.add('pixiv-user-muted');
          console.log(`Hid element (${hideLevels} levels up) for muted user:`, userIdMatch[1]);
        }
      }
    });
  }

  function addMutedIndicatorToProfile() {
    const currentUrl = window.location.href;
    const userMatch = currentUrl.match(/\/users\/(\d+)/);
    
    if (userMatch) {
      const userId = userMatch[1];
      const mutedUserIds = mutedUsers.map(user => user.userId);
      
      if (mutedUserIds.includes(userId)) {
        if (document.querySelector('.pixiv-muted-indicator')) {
          return;
        }
        
        const profileSelectors = [
          'h1',
          '.user-name',
          '.sc-361637d8-0',
          '[data-gtm-action="click_user_name"]',
          'h2',
          '.profile-title'
        ];
        
        let targetElement = null;
        for (const selector of profileSelectors) {
          targetElement = document.querySelector(selector);
          if (targetElement && targetElement.textContent.trim().length > 0) {
            break;
          }
        }
        
        if (targetElement) {
          const indicator = document.createElement('span');
          indicator.className = 'pixiv-muted-indicator';
          indicator.textContent = 'ミュート中';
          indicator.title = 'このユーザーはミュートされています';
          
          if (targetElement.parentNode) {
            targetElement.parentNode.insertBefore(indicator, targetElement.nextSibling);
          }
        }
      }
    }
  }

  function startObserver() {
    const observer = new MutationObserver(function(mutations) {
      let shouldUpdate = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldUpdate = true;
            }
          });
        }
      });
      
      if (shouldUpdate) {
        setTimeout(() => {
          hideItemsFromMutedUsers();
          addMuteButtons();
          addMutedIndicatorToProfile();
        }, 100);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  window.pixivUserMuter = {
    setHideLevels: (levels) => {
      window.HIDE_LEVELS = levels;
      console.log('Hide levels set to:', levels);
    },
    testHide: (userId) => {
      const tempMuted = [{ userId: userId, userInfo: '' }];
      const userLinks = document.querySelectorAll('a[href*="/users/"]');
      userLinks.forEach(link => {
        const userIdMatch = link.href.match(/\/users\/(\d+)/);
        if (userIdMatch && tempMuted.some(user => user.userId === userIdMatch[1])) {
          const targetElement = getParentElement(link, window.HIDE_LEVELS || getHideLevels());
          console.log('Would hide this element:', targetElement);
        }
      });
    },
    getCurrentHideLevels: () => {
      return getHideLevels();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(); 