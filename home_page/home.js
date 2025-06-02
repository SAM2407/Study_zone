let containt = document.getElementById("explore");
let themeToggle = document.getElementById("theme-toggle");
let cards = document.getElementsByClassName("card");
let exploreHeading = document.querySelector("#explore h2");
let body = document.body;

let isDark = false;

function theme() {
    if (!isDark) {
        body.style.backgroundColor = "#121212";
        containt.style.backgroundColor = "#1e1e1e";
        containt.style.color = "white";
        exploreHeading.style.color = "white";

        for (let i = 0; i < cards.length; i++) {
            cards[i].style.backgroundColor = "#2c2c2c";
            cards[i].style.color = "white";
        }

        themeToggle.textContent = "☀️ Light Mode";
    } else {
        body.style.backgroundColor = "white";
        containt.style.backgroundColor = "white";
        containt.style.color = "black";
        exploreHeading.style.color = "black";

        for (let i = 0; i < cards.length; i++) {
            cards[i].style.backgroundColor = "white";
            cards[i].style.color = "black";
        }

        themeToggle.textContent = "🌙 Dark Mode";
    }

    isDark = !isDark;
}

themeToggle.addEventListener("click", theme);

document.getElementById('Create_group').addEventListener('click',function(){
    window.location.href = 'createGroup.html';
});
