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
