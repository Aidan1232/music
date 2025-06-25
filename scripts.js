    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const audio = document.getElementById('audio');
    const playlist = document.getElementById('playlist');
    const playPauseBtn = document.getElementById('playPause');
    const trackTitle = document.getElementById('trackTitle');
    const volumeSlider = document.getElementById('volumeSlider');
    const timeDisplay = document.getElementById('timeDisplay');
    const progressBar = document.getElementById('progressBar');
    const tracks = playlist.querySelectorAll('li');
    let isPlaying = false;
    let animationId;
    let showVisualizer = true;
    let lastBassAvg = 0;
    let bassHistory = [];
    const smoothingWindow = 60; // how many frames to average


    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audio);

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    playlist.addEventListener('click', (e) => {
      const selected = e.target.closest('li');
      if (!selected) return;

      [...playlist.children].forEach(li => li.classList.remove('active', 'playing'));

      selected.classList.add('active');
      trackTitle.textContent = `Now Playing: ${selected.innerText.trim()}`;
      audio.src = selected.getAttribute('data-src');
      audio.play();
    });

    tracks.forEach((track, hoveredIndex) => {
      track.addEventListener('mouseenter', () => {
        tracks.forEach((t, i) => {
          if (i === hoveredIndex) {
            t.classList.add('hovered');
            t.style.transform = 'scale(1.15) translateX(60%)';
            t.style.zIndex = 100;
          } else {
            t.classList.remove('hovered');
            t.style.transform = 'translateX(20%)';
            t.style.zIndex = 100 - Math.abs(i - hoveredIndex);
          }
        });
      });

      track.addEventListener('mouseleave', () => {
        tracks.forEach((t) => {
          t.classList.remove('hovered');
          t.style.transform = '';
          t.style.zIndex = '';
        });
      });
    });

    volumeSlider.addEventListener('input', (e) => {
      audio.volume = e.target.value;
    });

    document.getElementById('toggleVisualizer').addEventListener('change', (e) => {
      showVisualizer = e.target.checked;

      if (showVisualizer && isPlaying) {
        draw(); // restart loop
      } else {
        cancelAnimationFrame(animationId);
        animationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    // Format helper (if you haven’t already)
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // When metadata loads
    audio.addEventListener('loadedmetadata', () => {
      timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    // While track is playing
    audio.addEventListener('timeupdate', () => {
      timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    function draw() {
      if (!showVisualizer) return;
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const height = dataArray[i] * 1.2;
        const hue = i * 3;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - height, barWidth, height);
        x += barWidth;
      }

      // Pulse based on bass
      const bass = dataArray.slice(0, 10);
      const bassAvg = bass.reduce((a, b) => a + b, 0) / bass.length;

      // Update rolling average
      bassHistory.push(bassAvg);
      if (bassHistory.length > smoothingWindow) bassHistory.shift();

      const meanBass = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;
      const delta = bassAvg - meanBass;

      // Use delta to calculate pulse strength, and clamp it
      const normDelta = Math.max(0, Math.min(delta / 50, 1)); // adjust divisor for sensitivity

      const hue = 180 + normDelta * 60;
      const light = 50 + normDelta * 20;
      progressBar.style.backgroundColor = `hsl(${hue}, 100%, ${light}%)`;

      const progress = audio.currentTime / audio.duration;
      if (!isNaN(progress)) {
        progressBar.style.width = `${progress * 100}%`;
      }
    }

    audio.onplay = () => {
      audioCtx.resume();
      isPlaying = true;
      playPauseBtn.textContent = '⏸️';

      const active = document.querySelector('li.active');
      if (active) active.classList.add('playing');

      draw();
    };

    audio.onpause = () => {
      isPlaying = false;
      playPauseBtn.textContent = '▶️';

      const active = document.querySelector('li.active');
      if (active) active.classList.remove('playing');
    };

    playPauseBtn.onclick = () => {
      if (!audio.src) return;
      isPlaying ? audio.pause() : audio.play();
    };