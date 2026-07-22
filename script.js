document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".search-box");
  const input = form?.querySelector("input");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    alert(`"${query}" 검색 기능은 아직 준비 중입니다.`);
  });
});
