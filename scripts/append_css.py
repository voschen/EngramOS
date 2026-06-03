css = """
/* Animated SVG Flow */
.path-line {
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}
.path-line.flow {
  stroke: var(--green);
  stroke-dasharray: 8;
  animation: flowAnim 1s linear infinite;
}
@keyframes flowAnim {
  from { stroke-dashoffset: 16; }
  to { stroke-dashoffset: 0; }
}
.path-line.highlight {
  stroke: var(--purple);
  stroke-width: 3px;
  filter: drop-shadow(0 0 4px rgba(127, 119, 221, 0.6));
}

/* Premium Glass Cards */
.tree-phase {
  background: rgba(26, 26, 30, 0.85) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.tree-phase:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}
.tree-phase.done {
  border-color: rgba(29, 158, 117, 0.4) !important;
  box-shadow: 0 8px 32px rgba(29, 158, 117, 0.1) !important;
}

/* Dashboard Analytics */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}
.dash-card {
  background: linear-gradient(145deg, var(--bg2), rgba(30, 30, 35, 0.4));
  border: 1px solid var(--border);
  border-radius: var(--rl);
  padding: 24px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 20px rgba(0,0,0,0.2);
}
.dash-stat {
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
  margin: 8px 0;
  background: linear-gradient(to right, #fff, var(--text2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.dash-lbl {
  font-size: 13px;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.2s;
}
.activity-item:hover {
  background: rgba(255, 255, 255, 0.03);
}
.activity-item:last-child {
  border-bottom: none;
}
.activity-meta {
  font-size: 11px;
  color: var(--text3);
}
"""

with open("styles.css", "a", encoding="utf-8") as f:
    f.write(css)
