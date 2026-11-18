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

function profileAddress(profile) {
  if (profile.public_slug) return new URL('/u/' + encodeURIComponent(profile.public_slug), location.origin);
  const address = new URL('/account.html', location.origin);
  address.searchParams.set('profile', profile.public_id);
  return address;
}

function prepareShare() {
  const user = memberView();
  const profile = user && collection?.profile;
  const id = profile?.public_id;
  shareLogin.hidden = Boolean(user);
  createLink.hidden = !user || Boolean(profile?.public_slug);
  createLink.disabled = !collection;
  shareDialog.querySelector('#profile-link-field').hidden = !id;
  copyLink.hidden = !id;
  profileLink.value = id ? profileAddress(profile).href : '';
  document.querySelector('#share-description').hidden = !user;
  if (!user) {
    const form = emailWidget.querySelector('form');
    const input = form?.querySelector('input');
    if (input) {
      input.placeholder = '輸入email認證 即可分享遊戲清單~';
      form.dataset.emailHint = input.placeholder;
    }
    shareLogin.append(emailWidget);
  }
}

document.querySelector('#share-profile').addEventListener('click', () => {
  shareStatus.textContent = '';
  prepareShare();
  shareDialog.showModal();
  if (memberView() && collection?.profile.public_id && !collection.profile.public_slug) createProfileLink();
});
shareDialog.addEventListener('close', () => {
  if (emailWidget && shareLogin.contains(emailWidget)) {
    const form = emailWidget.querySelector('form');
    const input = form?.querySelector('input');
    if (input) {
      input.placeholder = '不用記密碼，連結 Email 加入會員';
      form.dataset.emailHint = input.placeholder;
    }
    document.querySelector('#backup-note').prepend(emailWidget);
  }
});
let creatingShareFor = '';
async function createProfileLink() {
  const userId = PlayFeedAuth.user?.id;
  if (!userId || !collection || creatingShareFor === userId) return;
  creatingShareFor = userId;
  createLink.disabled = true;
  shareStatus.textContent = '正在建立分享連結…';
  try {
    const {id, slug} = await accountAction({action:'share-profile'});
    if (PlayFeedAuth.user?.id !== userId || !collection) return;
    collection.profile.public_id = id;
    collection.profile.public_slug = slug;
    PlayFeedAuth.clearShareIntent();
    shareStatus.textContent = '';
    prepareShare();
    if (shareDialog.open) {
      profileLink.focus();
      profileLink.select();
    }
  } catch (error) {
    if (PlayFeedAuth.user?.id === userId) shareStatus.textContent = error.message;
  } finally {
    if (creatingShareFor === userId) {
      creatingShareFor = '';
      createLink.disabled = false;
    }
  }
}
function resumeShareAfterLogin() {
  const autoShare = PlayFeedAuth.hasShareIntent();
  if (!shareDialog.open && !autoShare) return;
  prepareShare();
  if (!autoShare) return;
  if (!shareDialog.open) shareDialog.showModal();
  if (collection.profile.public_slug) PlayFeedAuth.clearShareIntent();
  else createProfileLink();
}
createLink.addEventListener('click', createProfileLink);
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
      link.href = profileAddress(profile).href;
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
