const shareDialog = document.querySelector('#share-dialog');
const createLink = document.querySelector('#create-profile-link');
const profileLink = document.querySelector('#profile-link');
const copyLink = document.querySelector('#copy-profile-link');
const shareStatus = document.querySelector('#share-status');
const shareLogin = document.querySelector('#share-login');
const emailWidget = document.querySelector('#phuze-inline-widget');
const followButton = document.querySelector('#follow-profile');

function accountAction(body) {
  return PlayFeedAuth.api('/api/account', {method:'POST',body:JSON.stringify(body)});
}

function profileAddress(id) {
  const address = new URL('/account.html', location.origin);
  address.searchParams.set('profile', id);
  return address;
}

function prepareShare() {
  const user = memberView();
  const id = user && collection?.profile.public_id;
  shareLogin.hidden = Boolean(user);
  createLink.hidden = !user || Boolean(id);
  createLink.disabled = !collection;
  shareDialog.querySelector('#profile-link-field').hidden = !id;
  copyLink.hidden = !id;
  profileLink.value = id ? profileAddress(id).href : '';
  if (!user) shareLogin.append(emailWidget);
}

document.querySelector('#share-profile').addEventListener('click', () => {
  shareStatus.textContent = '';
  prepareShare();
  shareDialog.showModal();
});
shareDialog.addEventListener('close', () => {
  if (emailWidget && shareLogin.contains(emailWidget)) {
    document.querySelector('#backup-note').prepend(emailWidget);
  }
});
createLink.addEventListener('click', async () => {
  const current = collection;
  if (!current) return;
  createLink.disabled = true;
  try {
    const {id} = await accountAction({action:'share-profile'});
    if (collection !== current) return;
    current.profile.public_id = id;
    prepareShare();
    profileLink.focus();
    profileLink.select();
  } catch (error) {
    if (collection === current) shareStatus.textContent = error.message;
  } finally {
    if (collection === current) createLink.disabled = false;
  }
});
copyLink.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(profileLink.value);
    shareStatus.textContent = '已複製連結。';
  } catch {
    profileLink.focus();
    profileLink.select();
    shareStatus.textContent = '請複製上方連結。';
  }
});

const followingDialog = document.querySelector('#following-dialog');
const followingList = document.querySelector('#following-list');
let followingRequest = 0;
document.querySelector('#open-following').addEventListener('click', async () => {
  const version = ++followingRequest;
  followingList.textContent = '正在載入…';
  followingDialog.showModal();
  try {
    const {profiles} = await PlayFeedAuth.api('/api/account?action=following');
    if (version !== followingRequest || !followingDialog.open) return;
    followingList.replaceChildren();
    for (const profile of profiles) {
      const link = document.createElement('a');
      link.className = 'following-profile';
      link.href = profileAddress(profile.public_id).href;
      const picture = document.createElement('span');
      picture.className = 'avatar';
      showAvatar(picture, profile);
      link.append(picture, profile.display_name);
      followingList.append(link);
    }
    if (!profiles.length) followingList.textContent = '你還沒有追蹤任何人。';
  } catch (error) {
    if (version === followingRequest && followingDialog.open) followingList.textContent = error.message;
  }
});

followButton.addEventListener('click', () => {
  const active = !collection?.following;
  PlayFeedAuth.requireLogin(async () => {
    const status = document.querySelector('#follow-status');
    followButton.disabled = true;
    status.textContent = '';
    try {
      await accountAction({action:'follow', profile:publicProfileId, active});
      await loadPublicCollection();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      followButton.disabled = false;
    }
  });
});

document.querySelector('.member-home').addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (window.navigation?.canGoBack ?? Boolean(document.referrer && history.length > 1)) {
    event.preventDefault();
    history.back();
  }
});
