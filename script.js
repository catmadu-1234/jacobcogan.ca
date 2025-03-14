const carouselItems = document.querySelectorAll('.carousel-item');
const leftArrow = document.querySelector('.left-arrow');
const rightArrow = document.querySelector('.right-arrow');
let currentIndex = 0;

function updateCarousel(index) {
    carouselItems.forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

leftArrow.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + carouselItems.length) % carouselItems.length;
    updateCarousel(currentIndex);
});

rightArrow.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % carouselItems.length;
    updateCarousel(currentIndex);
});

const carouselImages = document.querySelectorAll('.carousel img');
const container = document.querySelector('.container');

container.addEventListener('mousemove', (event) => {
    const { clientX, clientY, currentTarget } = event;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const xPercent = ((clientX - left) / width - 0.5) * 10; // Horizontal movement
    const yPercent = ((clientY - top) / height - 0.5) * 10; // Vertical movement

    carouselImages.forEach((img) => {
        img.style.transform = `translate(${xPercent}px, ${yPercent}px) scale(1.1)`;
    });
});

container.addEventListener('mouseleave', () => {
    carouselImages.forEach((img) => {
        img.style.transform = 'translate(0, 0) scale(1.1)';
    });
});
