function AudioBars({ size = 16, color = "currentColor" }) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          .eqBar { fill: ${color}; }
          @keyframes eq1 {
            0%, 100% { height: 4px; y: 6px; }
            50% { height: 12px; y: 2px; }
          }
          @keyframes eq2 {
            0%, 100% { height: 8px; y: 4px; }
            50% { height: 14px; y: 1px; }
          }
          @keyframes eq3 {
            0%, 100% { height: 5px; y: 5.5px; }
            50% { height: 11px; y: 2.5px; }
          }
          .eb1 { animation: eq1 0.8s ease-in-out infinite; }
          .eb2 { animation: eq2 0.6s ease-in-out infinite; }
          .eb3 { animation: eq3 0.75s ease-in-out infinite; }
        `}</style>
        <rect className="eqBar eb1" x="2" y="6" width="3" height="4" rx="1"/>
        <rect className="eqBar eb2" x="6.5" y="4" width="3" height="8" rx="1"/>
        <rect className="eqBar eb3" x="11" y="5.5" width="3" height="5" rx="1"/>
      </svg>
    )
  }
  
  export default AudioBars