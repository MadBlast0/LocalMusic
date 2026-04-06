# Local Music

A modern, open-source desktop music manager and downloader built with Electron. Organize your local music library and download audio from various online sources.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F.svg)

## ⚠️ Legal Disclaimer

This application is intended for downloading and managing audio content that you have the legal right to access. Users are responsible for ensuring they comply with all applicable copyright laws and terms of service of content providers. The developers do not endorse or encourage copyright infringement.

## ✨ Features

- **Modern UI/UX** - Clean, dark-themed interface with smooth animations and cyberpunk aesthetics
- **Music Library** - Organize and manage your local music collection with folder support
- **Built-in Player** - Play your music directly in the app with full playback controls
- **Smart Downloads** - Download audio from supported online sources with intelligent matching
- **Batch Operations** - Download multiple tracks simultaneously with configurable concurrency (1-5)
- **File Management** - Create folders, rename, move, and delete tracks
- **Format Support** - Automatic conversion to high-quality MP3 (320kbps)
- **Import Playlists** - Import track lists from CSV, TXT, or JSON files
- **Progress Tracking** - Visual download progress with circular indicators
- **Cache Management** - Built-in cache clearing and memory optimization
- **Cross-Platform** - Works on Windows, macOS, and Linux

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **yt-dlp** - Audio/video downloader ([Installation Guide](https://github.com/yt-dlp/yt-dlp#installation))
- **ffmpeg** - Audio processing ([Installation Guide](https://ffmpeg.org/download.html))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MadBlast0/local-music.git
cd local-music
```

2. Install dependencies:
```bash
npm install
```

3. Install required tools:

**Windows (using winget):**
```bash
winget install yt-dlp
winget install ffmpeg
```

**macOS (using Homebrew):**
```bash
brew install yt-dlp
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install yt-dlp ffmpeg
```

4. Start the application:
```bash
npm start
```

## 📦 Building

To create a distributable package:

```bash
npm run build
```

This will create platform-specific installers in the `dist` folder.

## 🎯 Usage

### Library Page
- View and manage your downloaded music
- Create folders to organize tracks
- Search and sort your collection
- Play music directly from the app with full player controls
- Shuffle and repeat modes
- Volume control

### Downloader Page
- Enter URLs from supported sources
- Import playlist files (CSV, TXT, JSON)
- Download individual tracks or entire playlists
- Monitor download progress with visual indicators
- Download All / Cancel All functionality
- Smart retry for failed downloads

### Settings Page
- Configure download location
- Adjust download concurrency (1-5 simultaneous downloads)
- Check dependency status (yt-dlp, ffmpeg)
- Clear cache and free memory
- View system memory usage

## 🛠️ Technology Stack

- **Electron** - Desktop application framework
- **Node.js** - Backend runtime
- **yt-dlp** - Media downloading
- **ffmpeg** - Audio processing
- **HTML/CSS/JavaScript** - Frontend (no frameworks, pure vanilla JS)

## 📝 File Format Support

### Import Formats
- **CSV** - `track_name, artist_name, duration`
- **TXT** - One track per line (Artist - Track format)
- **JSON** - Structured track data with fields: `name`, `artist`, `duration`

### Output Format
- **MP3** - High-quality audio (320kbps)
- Automatic metadata extraction from filenames
- Format: `Song Name - Artist Name.mp3`

## ⚙️ Configuration

The app stores configuration in:
- **Windows:** `%APPDATA%/local-music/config.json`
- **macOS:** `~/Library/Application Support/local-music/config.json`
- **Linux:** `~/.config/local-music/config.json`

Default download location:
- **Windows:** `%USERPROFILE%/Downloads/Simple Music Downloader`
- **macOS:** `~/Downloads/Simple Music Downloader`
- **Linux:** `~/Downloads/Simple Music Downloader`

## 🎨 Features in Detail

### Smart Download System
- Configurable concurrency (1-5 simultaneous downloads)
- Queue management system
- Visual progress indicators with circular animations
- Automatic retry on failure
- File existence detection (prevents re-downloading)

### Music Player
- Full playback controls (Play, Pause, Next, Previous)
- Shuffle mode
- Repeat modes (Off, All, One)
- Volume control with mute
- Progress bar with seek functionality
- Now playing display

### File Organization
- Automatic library scanning
- Nested folder support
- Search functionality
- Sort by name, artist, or date added
- Drag-free file management

## 🐛 Troubleshooting

### Dependencies Not Found

1. Ensure yt-dlp and ffmpeg are installed
2. Verify they're in your system PATH
3. Restart the application
4. Click "Re-check" in Settings

### Download Failures

1. Reduce concurrency to 1-2 in Settings
2. Check internet connection
3. Verify the source URL is valid
4. Check console logs for detailed errors
5. Try the retry button on failed downloads

### Audio Not Playing

1. Ensure the file exists in the download folder
2. Check file permissions
3. Verify ffmpeg is installed correctly
4. Try re-downloading the track

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Test on multiple platforms if possible
- Update documentation for new features
- Add comments for complex logic

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Media downloading tool
- [ffmpeg](https://ffmpeg.org/) - Audio/video processing
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [Inter Font](https://rsms.me/inter/) - UI typography

## 💬 Support

If you encounter any issues or have questions:
- Open an [Issue](https://github.com/MadBlast0/local-music/issues)
- Check existing issues for solutions
- Read the troubleshooting section above

## 🔮 Roadmap

- [ ] Audio equalizer
- [ ] Enhanced playlist management
- [ ] Lyrics support
- [ ] Theme customization
- [ ] Keyboard shortcuts
- [ ] Mini player mode
- [ ] Last.fm scrobbling
- [ ] Cloud sync integration
- [ ] Mobile companion app

## 📸 Screenshots

*Coming soon - Add screenshots of your app here*

## ⭐ Star History

If you find this project useful, please consider giving it a star!

---

**Made with ❤️ by the community**

**Note:** This software is provided as-is. Always respect copyright laws and content creators' rights.
