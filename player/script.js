"use strict";

/* ==========================================
   DIYAR PLAYER v1.0
   Part 1 : Core
========================================== */

const audio = document.getElementById("audio");
const video = document.getElementById("video");

const fileInput = document.getElementById("fileInput");

const playlist = document.getElementById("playlist");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const seekBar = document.getElementById("seekBar");
const volumeBar = document.getElementById("volumeBar");

const title = document.getElementById("title");
const artist = document.getElementById("artist");

const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");

let files = [];
let currentIndex = -1;
let player = audio;

function formatTime(sec){

    if(isNaN(sec)) return "00:00";

    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60);

    return String(m).padStart(2,"0") +
    ":" +
    String(s).padStart(2,"0");
}
/* ==========================================
   Part 2 : Playlist
========================================== */

fileInput.addEventListener("change", e => {

    files = Array.from(e.target.files);

    playlist.innerHTML = "";

    if(files.length === 0){

        title.textContent = "فایلی انتخاب نشده است";
        artist.textContent = "Diyar Player";

        return;

    }

    files.forEach((file,index)=>{

        const li = document.createElement("li");

        li.textContent = file.name;

        li.onclick = ()=>{

            loadFile(index);

        };

        playlist.appendChild(li);

    });

    loadFile(0);

});

function loadFile(index){

    if(index<0 || index>=files.length) return;

    currentIndex = index;

    const file = files[index];

    const url = URL.createObjectURL(file);

    title.textContent = file.name;

    artist.textContent = file.type;

    if(file.type.startsWith("video")){

        audio.pause();

        audio.style.display="none";

        video.style.display="block";

        video.src = url;

        player = video;

    }else{

        video.pause();

        video.style.display="none";

        audio.style.display="block";

        audio.src = url;

        player = audio;

    }

    player.play();

    playBtn.textContent="⏸";

}
