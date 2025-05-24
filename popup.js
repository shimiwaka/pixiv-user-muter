document.addEventListener('DOMContentLoaded', function() {
  const userIdInput = document.getElementById('userId');
  const userInfoInput = document.getElementById('userInfo');
  const muteBtn = document.getElementById('muteBtn');
  const unmuteBtn = document.getElementById('unmuteBtn');
  const mutedUsersDiv = document.getElementById('mutedUsers');

  loadMutedUsers();
  autoFillUserIdFromCurrentPage();

  muteBtn.addEventListener('click', function() {
    const userId = userIdInput.value.trim();
    const userInfo = userInfoInput.value.trim();
    if (userId) {
      addMutedUser(userId, userInfo);
      userIdInput.value = '';
      userInfoInput.value = '';
    }
  });

  unmuteBtn.addEventListener('click', function() {
    const userId = userIdInput.value.trim();
    if (userId) {
      removeMutedUser(userId);
      userIdInput.value = '';
      userInfoInput.value = '';
    }
  });

  async function autoFillUserIdFromCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (tab.url && tab.url.includes('pixiv.net/users/')) {
        const userIdMatch = tab.url.match(/\/users\/(\d+)/);
        if (userIdMatch) {
          userIdInput.value = userIdMatch[1];
          userIdInput.style.backgroundColor = '#e8f5e8';
          setTimeout(() => {
            userIdInput.style.backgroundColor = '';
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error auto-filling user ID:', error);
    }
  }

  async function addMutedUser(userId, userInfo = '') {
    if (!userId || !/^\d+$/.test(userId)) {
      alert('有効なユーザーIDを入力してください（数字のみ）');
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['mutedUsers']);
      let mutedUsers = result.mutedUsers || [];
      
      if (Array.isArray(mutedUsers) && typeof mutedUsers[0] === 'string') {
        mutedUsers = mutedUsers.map(id => ({ userId: id, userInfo: '' }));
      }
      
      const existingUser = mutedUsers.find(user => user.userId === userId);
      if (!existingUser) {
        mutedUsers.push({ userId: userId, userInfo: userInfo });
        await chrome.storage.sync.set({mutedUsers: mutedUsers});
        loadMutedUsers();
        
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        chrome.tabs.sendMessage(tab.id, {action: 'updateMutedUsers', mutedUsers: mutedUsers});
        
      } else {
        alert('このユーザーは既にミュートされています');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  }

  async function removeMutedUser(userId) {
    try {
      const result = await chrome.storage.sync.get(['mutedUsers']);
      let mutedUsers = result.mutedUsers || [];
      
      if (Array.isArray(mutedUsers) && typeof mutedUsers[0] === 'string') {
        mutedUsers = mutedUsers.map(id => ({ userId: id, userInfo: '' }));
      }
      
      const updatedUsers = mutedUsers.filter(user => user.userId !== userId);
      
      await chrome.storage.sync.set({mutedUsers: updatedUsers});
      loadMutedUsers();
      
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      chrome.tabs.sendMessage(tab.id, {action: 'updateMutedUsers', mutedUsers: updatedUsers});
      
    } catch (error) {
      alert('エラーが発生しました');
    }
  }

  async function loadMutedUsers() {
    try {
      const result = await chrome.storage.sync.get(['mutedUsers']);
      let mutedUsers = result.mutedUsers || [];
      
      if (Array.isArray(mutedUsers) && typeof mutedUsers[0] === 'string') {
        mutedUsers = mutedUsers.map(id => ({ userId: id, userInfo: '' }));
        await chrome.storage.sync.set({mutedUsers: mutedUsers});
      }
      
      mutedUsersDiv.innerHTML = '';
      
      if (mutedUsers.length === 0) {
        mutedUsersDiv.innerHTML = '<p>ミュートされたユーザーはいません</p>';
        return;
      }
      
      mutedUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'muted-user';
        
        const userInfoDiv = document.createElement('div');
        userInfoDiv.className = 'user-info';
        
        const userIdSpan = document.createElement('div');
        userIdSpan.className = 'user-id';
        userIdSpan.textContent = `ID: ${user.userId}`;
        
        userInfoDiv.appendChild(userIdSpan);
        
        if (user.userInfo) {
          const userNameSpan = document.createElement('div');
          userNameSpan.className = 'user-name';
          userNameSpan.textContent = user.userInfo;
          userInfoDiv.appendChild(userNameSpan);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '削除';
        removeBtn.addEventListener('click', function() {
          removeMutedUser(user.userId);
        });
        
        userDiv.appendChild(userInfoDiv);
        userDiv.appendChild(removeBtn);
        mutedUsersDiv.appendChild(userDiv);
      });
    } catch (error) {
      mutedUsersDiv.innerHTML = '<p>エラーが発生しました</p>';
    }
  }
}); 