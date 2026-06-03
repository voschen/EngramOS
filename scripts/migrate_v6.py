import os
import json
import uuid

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def generate_uid():
    return uuid.uuid4().hex[:8]

def migrate_field(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        field = json.load(f)
        
    old_phases = field.get('phases', [])
    if not old_phases:
        return
        
    # Check if this field has already been migrated (has 'depends_on')
    if old_phases and 'depends_on' in old_phases[0] and 'id' in old_phases[0]:
        print(f"Skipping {field.get('field', 'Unknown')} - already migrated to DAG.")
        return

    print(f"Migrating {field.get('field', 'Unknown')} to DAG...")
    
    # Assign IDs and chain dependencies
    previous_id = None
    for p in old_phases:
        if 'id' not in p:
            p['id'] = 'p_' + generate_uid()
        
        # Backward compatibility: linear sequence
        if previous_id:
            p['depends_on'] = [previous_id]
        else:
            p['depends_on'] = []
            
        previous_id = p['id']

    field['phases'] = old_phases
    
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
