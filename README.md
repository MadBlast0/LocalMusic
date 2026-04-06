# Local Music

A modern, open-source desktop music downloader and library manager built with Electron.

## Features

- Download music from YouTube and Spotify
- Built-in music library with playback controls
- Smart YouTube matching with duration filtering
- Cross-platform support (Windows, macOS, Linux)
- Modern, intuitive interface
- Concurrent downloads with configurable limits

## Installation

### From Release
Download the latest installer for your platform from the [Releases](https://github.com/MadBlast0/local-music/releases) page.

### From Source
```bash
# Clone the repository
git clone https://github.com/MadBlast0/local-music.git
cd local-music

# Install dependencies
npm install

# Run the app
npm start
```

## Building

### Generate App Icons
Before building, generate platform-specific icons from the SVG:

```bash
# Install icon builder globally
npm install -g electron-icon-builder

# Generate icons for all platforms
electron-icon-builder --input=./build/icon.svg --output=./build --flatten
```

This will create:
- `icon.ico` (Windows)
- `icon.icns` (macOS)
- `icon.png` (Linux)

Or use an online converter like [CloudConvert](https://cloudconvert.com/svg-to-ico) to convert the SVG manually.

### Build Installers
```bash
# Build for current platform
npm run build

# Build unpacked (for testing)
npm run build:dir
```

The installers will be in the `dist/` folder.

## Development

```bash
# Run in development mode
npm run dev
```

## Requirements

- Node.js 18 or higher
- yt-dlp (for downloading music)
- ffmpeg (for audio conversion to MP3)

### Installing Dependencies

#### Windows
```bash
# Using Chocolatey
choco install yt-dlp ffmpeg

# Or using Scoop
scoop install yt-dlp ffmpeg
```

#### macOS
```bash
# Using Homebrew
brew install yt-dlp ffmpeg
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt install yt-dlp ffmpeg

# Arch Linux
sudo pacman -S yt-dlp ffmpeg
```

## Usage

1. **Download Music**: Paste a YouTube or Spotify URL and click Fetch
2. **Import Playlists**: Import CSV, TXT, or JSON files with track lists
3. **Library**: View and play your downloaded music
4. **Settings**: Configure download location and concurrency

## Default Music Folder

Music is saved to: `%USERPROFILE%\Music\Local Music` (Windows) or `~/Music/Local Music` (macOS/Linux)

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues, please [open an issue](https://github.com/MadBlast0/local-music/issues) on GitHub.
