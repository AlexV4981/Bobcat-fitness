//create and resume audio from the camera-button gesture, then play once the countdown finishes
export function createStartChime() {
  const Context=window.AudioContext ?? window.webkitAudioContext;
  if(!Context)return {play:()=>false,resume(){},close(){}};
  let context;
  try {context=new Context();context.resume().catch(()=>{});} catch {return {play:()=>false,resume(){},close(){}};}
  return {
    resume(){context.resume().catch(()=>{});},
    play(){
      if(context.state!=='running')return false;
      const at=context.currentTime,oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type='sine';oscillator.frequency.setValueAtTime(1046.5,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.18,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.65);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.7);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      return true;
    },
    close(){context.close().catch(()=>{});},
  };
}
