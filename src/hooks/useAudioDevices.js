import { useState, useEffect, useRef, useCallback } from "react";

export function useAudioDevices() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedInput, setSelectedInput] = useState(null);
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [stream, setStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(null); // null=unknown, true, false
  const [micMonitorEnabled, setMicMonitorEnabled] = useState(false);

  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const monitorAudioRef = useRef(null); // <audio> element used to play the mic back (loopback)

  const loadDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    const outputs = devices.filter((d) => d.kind === "audiooutput");
    setInputDevices(inputs);
    setOutputDevices(outputs);
    if (inputs.length && !selectedInput) setSelectedInput(inputs[0].deviceId);
    if (outputs.length && !selectedOutput) setSelectedOutput(outputs[0].deviceId);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setHasPermission(true);
      await loadDevices();
    } catch {
      setHasPermission(false);
    }
  }, [loadDevices]);

  // Start mic stream and voice activity detection
  const startMic = useCallback(async (deviceId) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    }
    try {
      const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      setStream(s);

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const detect = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setIsSpeaking(avg > 10);
        animFrameRef.current = requestAnimationFrame(detect);
      };
      detect();

      // Loopback: play the mic back through the speakers so the user can
      // hear themselves while testing ("retour audio").
      if (!monitorAudioRef.current) {
        monitorAudioRef.current = new Audio();
      }
      const audioEl = monitorAudioRef.current;
      audioEl.srcObject = s;
      audioEl.muted = !micMonitorEnabled;
      if (selectedOutput && audioEl.setSinkId) {
        audioEl.setSinkId(selectedOutput).catch(() => {});
      }
      audioEl.play().catch(() => {});
    } catch {
      // mic not available
    }
  }, []);

  const stopMic = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (monitorAudioRef.current) {
      monitorAudioRef.current.pause();
      monitorAudioRef.current.srcObject = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    setIsSpeaking(false);
  }, []);

  // Toggle whether the user hears their own mic through the speakers
  const toggleMicMonitor = useCallback(() => {
    setMicMonitorEnabled((prev) => {
      const next = !prev;
      if (monitorAudioRef.current) {
        monitorAudioRef.current.muted = !next;
      }
      return next;
    });
  }, []);

  // Toggle mic mute (mute tracks without stopping stream)
  const toggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((t) => { t.enabled = next ? false : true; });
      }
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const hasLabels = devices.some((d) => d.label);
      if (hasLabels) {
        setHasPermission(true);
        loadDevices();
      }
    });
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
  }, [loadDevices]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return {
    inputDevices, outputDevices,
    selectedInput, setSelectedInput,
    selectedOutput, setSelectedOutput,
    isSpeaking, micMuted, speakerMuted,
    stream, hasPermission,
    requestPermission, startMic, stopMic,
    toggleMic, toggleSpeaker,
    micMonitorEnabled, toggleMicMonitor,
  };
}