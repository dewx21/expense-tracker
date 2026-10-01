// ---------- sidebar.js : collapse/expand + page navigation ----------
export function initSidebar(onPageChange){
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('collapseBtn');
  collapseBtn.onclick = () => sidebar.classList.toggle('collapsed');

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.onclick = () => {
      document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + item.dataset.page).classList.add('active');
      onPageChange && onPageChange(item.dataset.page);
    };
  });

  document.getElementById('logoutItem').onclick = () => {
    if (confirm('Log out? Your data stays saved on this device/account — this just clears the session view.')) {
      location.reload();
    }
  };
}