# Expertise Tracker

Expertise Tracker is a web-based DAG (Directed Acyclic Graph) knowledge engine designed to help you build and track your learning curricula. It visualizes learning phases and tracks your progress as you master theory and skills for any given subject.

## Features

- **DAG Curriculum Tracking**: Visualize your learning paths as a Directed Acyclic Graph.
- **Progress Assessment**: Track "Whole Part Whole" (Theory) and "Interleaving Project" (Skill) assessments.
- **Proof Validation**: Attach links to projects, YouTube videos, or other proofs of mastery for each phase.
- **Local Data Storage**: Runs locally with a lightweight Python backend to save your progress and media uploads.
- **Markdown Support**: Take rich notes with Markdown and image/video uploads.

## Prerequisites

- Python 3.x (to run the local server)

## Getting Started

1. Clone this repository.
2. Open a terminal/command prompt in the project directory.
3. Start the local backend server:
   ```bash
   python server.py
   ```
4. Open your web browser and navigate to `http://localhost:8000/index.html`.

## Creating Curricula with AI

The `ai_prompt_template.md` file contains a prompt you can use with AI models (like Claude or ChatGPT) to automatically generate a comprehensive, structured curriculum for any new subject. You can then import the resulting JSON directly into Expertise Tracker.
