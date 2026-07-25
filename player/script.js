"use strict";

/*=========================================
 DIYAR PLAYER v1.0
=========================================*/

const audio=document.getElementById("audio");
const video=document.getElementById("video");

const fileInput=document.getElementById("fileInput");
const playlist=document.getElementById("playlist");

const playBtn=document.getElementById("playBtn");
const prevBtn=document.getElementById("prevBtn");
const nextBtn=document.getElementById("nextBtn");

const seekBar=document.getElementById("seekBar");
const volumeBar=document.getElementById("volumeBar");

const title=document.getElementById("title");
const artist=document.getElementById("artist");

const currentTime=document.getElementById("currentTime");
const duration=document.getElementById("duration");

let files=[];
let currentIndex=-1;
let currentPlayer=audio;

function formatTime(sec){

if(isNaN(sec)) return "00:00";

const m=Math.floor(sec/60);
const s=Math.floor(sec%60);

return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");

}

function getPlayer(){

return currentPlayer;

}

function stopPlayers(){

audio.pause();
video.pause();

audio.removeAttribute("src");
video.removeAttribute("src");

}
/*=========================================
 Player Engine
=========================================*/

function loadFile(index){

if(index<0 || index>=files.length) return;

currentIndex=index;

const file=files[index];

const url=URL.createObjectURL(file);

title.textContent=file.name;
artist.textContent=file.type;

stopPlayers();

if(file.type.startsWith("video/")){

video.src=url;
video.style.display="block";
audio.style.display="none";

currentPlayer=video;

}else{

audio.src=url;
audio.style.display="block";
video.style.display="none";

currentPlayer=audio;

}

const p=getPlayer();

p.load();

p.onloadedmetadata=function(){

seekBar.max=Math.floor(p.duration)||0;

duration.textContent=formatTime(p.duration);

};

p.ontimeupdate=function(){

seekBar.value=Math.floor(p.currentTime);

currentTime.textContent=formatTime(p.currentTime);

};

p.onended=function(){

nextTrack();

};

p.oncanplay = function () {

    p.play()
    .then(function () {

        playBtn.textContent = "⏸";

    })
    .catch(function (err) {

        console.error("Play Error:", err);

    });

};

}

fileInput.addEventListener("change",function(e){

files=Array.from(e.target.files);

playlist.innerHTML="";

if(files.length===0){

title.textContent="فایلی انتخاب نشده است";
artist.textContent="Diyar Player";

return;

}

files.forEach(function(file,index){

const li=document.createElement("li");

li.textContent=file.name;

li.onclick=function(){

loadFile(index);

};

playlist.appendChild(li);

});

loadFile(0);

});
