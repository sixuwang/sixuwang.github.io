document.addEventListener('DOMContentLoaded', function () {
    // 获取核心DOM元素
    const photoCards = document.querySelectorAll('.photo-card');
    const yearFilterContainer = document.getElementById('yearFilter');
    const monthFilterContainer = document.getElementById('monthFilter');
    const modal = document.getElementById('photoModal');
    const modalImg = document.querySelector('.modal-img');
    const closeBtn = document.querySelector('.close-btn');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    // --- 1. 初始化归档数据 ---
    // 格式：{ '2026': ['1', '2'], '2025': ['4'] }
    const archiveData = {};

    // 遍历所有照片卡片，收集年份和月份信息
    photoCards.forEach(card => {
        const timeElement = card.querySelector('.time');
        if (!timeElement) return; // 容错：跳过无时间信息的卡片

        const rawDate = timeElement.textContent.trim();
        const dateParts = rawDate.split('-');

        // 容错：验证日期格式是否正确
        if (dateParts.length < 3 || isNaN(dateParts[0]) || isNaN(dateParts[1]) || isNaN(dateParts[2])) {
            console.warn(`无效日期格式: ${rawDate}，该卡片已跳过`);
            return;
        }

        const year = dateParts[0];
        const month = parseInt(dateParts[1], 10).toString(); // 统一格式："02" → "2"

        // 给卡片打数据标签，用于筛选
        card.dataset.year = year;
        card.dataset.month = month;

        // 存入归档数据（数组+去重，替代Set提升兼容性）
        if (!archiveData[year]) {
            archiveData[year] = [];
        }
        if (!archiveData[year].includes(month)) {
            archiveData[year].push(month);
        }
    });

    // --- 2. 渲染年份筛选按钮 ---
    let yearHTML = `<button class="filter-btn active" data-year="all">全部照片</button>`;
    // 年份倒序排列（最新年份在前）
    const years = Object.keys(archiveData).sort((a, b) => b - a);
    years.forEach(year => {
        yearHTML += `<button class="filter-btn" data-year="${year}">${year}年</button>`;
    });
    yearFilterContainer.innerHTML = yearHTML;

    // --- 3. 筛选状态管理 ---
    let currentYear = 'all';  // 当前选中的年份
    let currentMonth = 'all'; // 当前选中的月份
    let visiblePhotos = [];   // 保存当前显示的照片，用于弹窗切换
    let currentModalIndex = 0;// 弹窗当前显示的照片索引

    // --- 4. 年份筛选事件 ---
    yearFilterContainer.addEventListener('click', function (e) {
        const targetBtn = e.target.closest('.filter-btn');
        if (!targetBtn) return;

        // 切换激活状态
        yearFilterContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');

        // 更新筛选状态
        currentYear = targetBtn.dataset.year;
        currentMonth = 'all'; // 切换年份时重置月份筛选

        // 控制月份筛选栏显示/隐藏
        if (currentYear === 'all') {
            monthFilterContainer.style.display = 'none';
        } else {
            renderMonthButtons(currentYear);
            monthFilterContainer.style.display = 'flex';
        }

        // 执行筛选
        applyFilters();
    });

    // --- 5. 渲染月份筛选按钮 ---
    function renderMonthButtons(year) {
        let monthHTML = `<button class="filter-btn active" data-month="all">全部月份</button>`;
        // 月份正序排列
        const months = [...archiveData[year]].sort((a, b) => a - b);
        months.forEach(month => {
            monthHTML += `<button class="filter-btn" data-month="${month}">${month}月</button>`;
        });
        monthFilterContainer.innerHTML = monthHTML;
    }

    // --- 6. 月份筛选事件 ---
    monthFilterContainer.addEventListener('click', function (e) {
        const targetBtn = e.target.closest('.filter-btn');
        if (!targetBtn) return;

        // 切换激活状态
        monthFilterContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');

        // 更新筛选状态并执行筛选
        currentMonth = targetBtn.dataset.month;
        applyFilters();
    });

    // --- 7. 核心筛选逻辑 ---
    function applyFilters() {
        visiblePhotos = [];
        let currentIndex = 0;

        photoCards.forEach(card => {
            const cardYear = card.dataset.year;
            const cardMonth = card.dataset.month;

            // 判断是否显示该卡片
            let showCard = false;
            if (currentYear === 'all') {
                showCard = true; // 全部年份都显示
            } else if (cardYear === currentYear) {
                showCard = (currentMonth === 'all') || (cardMonth === currentMonth);
            }

            // 更新卡片显示状态
            if (showCard) {
                card.classList.remove('hidden');
                card.dataset.visibleIndex = currentIndex;
                // 收集显示的照片信息，用于弹窗
                visiblePhotos.push({
                    src: card.querySelector('.photo-img').src,
                    alt: card.querySelector('.photo-img').alt
                });
                currentIndex++;
            } else {
                card.classList.add('hidden');
            }
        });
    }

    // --- 8. 图片弹窗功能 ---
    // 缩放和拖拽相关变量
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;

    // 点击卡片打开弹窗
    photoCards.forEach(card => {
        card.addEventListener('click', function () {
            if (this.classList.contains('hidden')) return; // 隐藏的卡片不响应

            currentModalIndex = parseInt(this.dataset.visibleIndex, 10);
            updateModalImage();
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // 禁止页面滚动
        });
    });

    // 关闭弹窗
    function closeModal() {
        modal.style.display = 'none';
        resetZoom(); // 重置缩放和位置
        document.body.style.overflow = ''; // 恢复页面滚动
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        // 点击弹窗背景关闭
        if (e.target === modal || e.target.classList.contains('modal-content')) {
            closeModal();
        }
    });

    // 上一张/下一张切换
    prevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (visiblePhotos.length === 0) return;
        currentModalIndex = (currentModalIndex - 1 + visiblePhotos.length) % visiblePhotos.length;
        updateModalImage();
    });

    nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (visiblePhotos.length === 0) return;
        currentModalIndex = (currentModalIndex + 1) % visiblePhotos.length;
        updateModalImage();
    });

    // 键盘导航
    document.addEventListener('keydown', function (e) {
        if (modal.style.display !== 'flex') return;

        switch (e.key) {
            case 'ArrowLeft': prevBtn.click(); break;
            case 'ArrowRight': nextBtn.click(); break;
            case 'Escape': closeModal(); break;
            case '+': case '=': scale += 0.1; applyTransform(); break;
            case '-': scale -= 0.1; applyTransform(); break;
            case '0': resetZoom(); break;
        }
    });

    // 更新弹窗图片
    function updateModalImage() {
        if (visiblePhotos.length === 0) return;
        modalImg.src = visiblePhotos[currentModalIndex].src;
        modalImg.alt = visiblePhotos[currentModalIndex].alt;
        resetZoom(); // 切换图片时重置缩放
    }

    // 图片缩放和拖拽
    modalImg.addEventListener('wheel', function (e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        scale += e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
        scale = Math.min(Math.max(0.5, scale), 5); // 限制缩放范围
        applyTransform();
    }, { passive: false });

    modalImg.addEventListener('mousedown', function (e) {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        modalImg.style.transition = 'none'; // 拖拽时取消过渡动画
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    document.addEventListener('mouseup', function () {
        isDragging = false;
        modalImg.style.transition = 'transform 0.2s ease-out'; // 恢复过渡动画
    });

    document.addEventListener('mouseleave', function () {
        isDragging = false;
        modalImg.style.transition = 'transform 0.2s ease-out';
    });

    // 应用缩放和位移
    function applyTransform() {
        modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // 重置缩放和位移
    function resetZoom() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }

    // --- 初始化 ---
    applyFilters(); // 页面加载时默认显示全部照片
});