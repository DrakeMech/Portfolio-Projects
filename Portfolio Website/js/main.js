document.addEventListener('DOMContentLoaded', function () {
    const name = document.querySelector('.name');
    const logo = document.querySelector('.logo');
    const menuBtnDivs = document.querySelectorAll('.menuBtn div');

    // Scroll effect for menu
    window.addEventListener('scroll', function () {
        const isScrolledPastHero = window.scrollY > document.querySelector('.imageCover').offsetHeight - 100;

        // Change the opacity of the name and logo based on the scroll position
        const opacity = isScrolledPastHero ? 0 : 1;
        name.style.opacity = logo.style.opacity = opacity;

        // Change the background color of the menu buttons based on the scroll position
        const buttonBackgroundColor = isScrolledPastHero ? '#999' : '#FFF';
        menuBtnDivs.forEach(btnDiv => {
            btnDiv.style.background = buttonBackgroundColor;
        });
    });
});