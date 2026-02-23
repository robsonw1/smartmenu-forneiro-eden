// Arquivo de som de alerta em base64 (arquivo MP3 pequenininho de ~1 segundo)
// Este é um som simples de alerta que toca uma vez
export const ALERT_SOUND_BASE64 = 'data:audio/mp3;base64,//NExAAqAIIAVTEEQACAAABIAAAAA//NExA8qAIH//wAAP//5//38ABAA';

// Alternativa: Use uma URL de um arquivo MP3 público
export const ALERT_SOUND_URL = '/alert-sound.mp3';

// Se preferir gerar o som com Web Audio API
export const generateAlertAudio = (): HTMLAudioElement => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Frequência do alerta (em Hz) - som mais grave e notável
  oscillator.frequency.value = 800;
  
  // Duration: 200ms
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
  
  const audio = new Audio();
  return audio;
};
