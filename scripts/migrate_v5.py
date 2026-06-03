import os
import json
import uuid

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
NOTES_DIR = os.path.join(DATA_DIR, 'notes')

if not os.path.exists(NOTES_DIR):
    os.makedirs(NOTES_DIR)

def generate_uid():
    return uuid.uuid4().hex[:8]

def migrate_field(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        field = json.load(f)
        
    old_phases = field.get('phases', [])
    if not old_phases:
        return
        
    # Check if this field has already been roughly migrated or fits the new model
    if len(old_phases) == 1 and old_phases[0].get('name') == 'Fundamentals':
        print(f"Skipping {field['field']} - already seems migrated.")
        return

    print(f"Migrating {field['field']}...")
    
    new_nodes = []
    
    for old_phase in old_phases:
        # Create a new Node from the old Phase
        node_id = generate_uid()
        
        # Accumulate notes text
        notes_lines = [f"# {old_phase.get('name', 'Node Notebook')}", ""]
        if old_phase.get('focus'):
            notes_lines.append(f"*{old_phase['focus']}*")
            notes_lines.append("")
            
        notes_lines.append("## Keyword Syllabus")
        
        for old_node in old_phase.get('nodes', []):
            notes_lines.append(f"- **{old_node.get('name', 'Term')}**: {old_node.get('description', '')}")
            if old_node.get('proof_url'):
                notes_lines.append(f"  - Proof Link: {old_node['proof_url']}")
                
        # Write to the subfolder
        note_content = "\n".join(notes_lines)
        note_filepath = os.path.join(NOTES_DIR, f"{node_id}.md")
        with open(note_filepath, 'w', encoding='utf-8') as f_note:
            f_note.write(note_content)
            
        # Add the node
        new_nodes.append({
            "id": node_id,
            "name": old_phase.get('name', f"Phase {old_phase.get('phase', '')}"),
            "description": old_phase.get('focus', 'A foundational milestone.'),
            "axis": "mixed"
        })
        
    # Overwrite phases
    field['phases'] = [
        {
            "phase": 1,
            "name": "Fundamentals",
            "focus": "Core foundation generated from previous curriculum phases.",
            "level_cap": 10,
            "unlock_threshold": 80,
            "nodes": new_nodes
        }
    ]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(field, f, indent=2)

def main():
    if not os.path.exists(DATA_DIR):
        print("Data directory not found. Nothing to migrate.")
        return
        
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(DATA_DIR, filename)
            try:
                migrate_field(filepath)
            except Exception as e:
                print(f"Error migrating {filename}: {e}")
                
    print("Migration complete.")

if __name__ == '__main__':
    main()
