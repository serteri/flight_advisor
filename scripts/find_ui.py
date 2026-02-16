import os

def search_ui(root_dir):
    terms = ["View Deal", "Safe Redirect"]
    print(f"Searching for {terms} in {root_dir}...")
    
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.next' in dirs: dirs.remove('.next')
        if '.git' in dirs: dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for term in terms:
                                if term in line:
                                    rel_path = os.path.relpath(file_path, root_dir)
                                    print(f"MATCH: '{term}' in {rel_path}:{i+1}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    search_ui(os.getcwd())
