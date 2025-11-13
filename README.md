# ODIADEV Voice AI Application

An advanced voice AI interface with real-time speech recognition, voice activity detection (VAD), and text-to-speech capabilities. Built with React, TypeScript, and modern web technologies.

## 🚀 Features

### Core Capabilities
- **Real-time Speech Recognition** - Continuous voice input processing
- **Advanced VAD (Voice Activity Detection)** - Energy + Zero-Crossing Rate analysis with auto-calibration
- **Text-to-Speech** - Multiple voice options with different accents
- **Session Management** - Complete conversation history with metrics

### Advanced Features
- **Real-time Confidence Meter** - Visual feedback for speech detection confidence
- **Audio Filtering** - High-pass and low-pass filters for cleaner input
- **Connection Quality Monitoring** - Adaptive performance based on network conditions
- **Session Metrics Dashboard** - Track performance and usage statistics
- **Pause/Resume Control** - Seamless listening control
- **Error Handling** - Comprehensive error boundaries and user feedback

### Security & Performance
- **Secure API Key Management** - Environment variable based configuration
- **Memory Leak Prevention** - Proper cleanup and resource management
- **Performance Optimizations** - Efficient audio processing and state management
- **TypeScript Support** - Full type safety and better development experience

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide Icons
- **Audio Processing**: Web Audio API, Speech Recognition API
- **AI Integration**: Groq API (Llama 3.3), MiniMax TTS
- **Build Tool**: Vite with Hot Module Replacement

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Modern browser with Web Audio API support
- API keys for Groq and MiniMax services

### Quick Start

1. **Clone and Install**
   ```bash
   cd /Users/odiadev/Desktop/voiceai webapp
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm run preview
   ```

## 🔑 API Configuration

### Groq AI (Required)
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

### MiniMax TTS (Required for voice synthesis)
```env
VITE_MINIMAX_API_KEY=your_minimax_api_key_here
VITE_MINIMAX_GROUP_ID=your_minimax_group_id_here
VITE_MINIMAX_MODEL=speech-02-hd
```

### OpenAI (Optional)
```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_USE_OPENAI_REALTIME=false
```

## 🎯 Usage

### Basic Operation
1. **Start Listening**: Click the microphone button
2. **Speak Naturally**: The app will automatically detect when you're speaking
3. **View Responses**: AI responses appear in the conversation window
4. **Control Playback**: Use pause/resume buttons as needed

### Advanced Controls
- **Voice Selection**: Click settings to choose different voices
- **Session Reset**: Clear conversation history and start fresh
- **Performance Monitoring**: View real-time metrics and connection quality

## 🔧 Configuration

### Audio Settings
```env
VITE_AUDIO_SAMPLE_RATE=16000
VITE_AUDIO_CHANNEL_COUNT=1
```

### VAD Parameters
The VAD system uses these configurable thresholds:
- Energy threshold: Auto-calibrated based on background noise
- Zero-crossing rate threshold: 0.3 (optimized for speech)
- Confidence scoring: 0-100% with color-coded feedback

## 🚨 Error Handling

The application includes comprehensive error handling for:
- Microphone permission denials
- Network connectivity issues
- API service failures
- Browser compatibility problems
- Audio processing errors

## 📊 Performance Metrics

### Real-time Monitoring
- **Latency**: Response time measurement
- **Connection Quality**: Network condition assessment
- **Speech Confidence**: VAD accuracy indication
- **Error Rate**: Failure tracking

### Session Analytics
- Total message count
- Average response latency
- Interruption frequency
- Error occurrence tracking

## 🌐 Browser Support

- **Chrome/Chromium**: Full support
- **Firefox**: Full support (may require permissions)
- **Safari**: Full support (iOS 14.3+)
- **Edge**: Full support

## 🔒 Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **HTTPS**: Always use HTTPS in production for microphone access
3. **CORS**: Configure proper CORS headers for API endpoints
4. **Rate Limiting**: Implement rate limiting for API calls

## 🐛 Troubleshooting

### Common Issues

**Microphone Not Working**
- Check browser permissions
- Ensure HTTPS in production
- Verify microphone hardware

**No Speech Recognition**
- Check browser compatibility
- Verify language settings
- Test with different browsers

**High Latency**
- Check network connection quality
- Monitor API response times
- Consider using CDN for static assets

**Audio Quality Issues**
- Adjust audio constraints
- Check microphone hardware
- Verify audio filtering settings

## 📈 Future Enhancements

- [ ] Multi-language support
- [ ] Offline speech recognition
- [ ] Custom wake word detection
- [ ] Advanced noise cancellation
- [ ] Voice biometrics
- [ ] Conversation context persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify API key configuration
4. Test with different browsers
5. Submit an issue with detailed logs

---

**Built with ❤️ by ODIADEV**