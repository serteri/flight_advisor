import os

def search_keys(root_dir):
    keys = ["bookButton", "safeRedirect", "Results.bookButton", "Results.safeRedirect", "FlightSearch.bookButton"]
    print(f"Searching for keys {keys} in {root_dir}...")
    
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.next' in dirs: dirs.remove('.next')
        if '.git' in dirs: dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for key in keys:
                                # Look for key surrounded by quotes or in t call
                                if key in line:
                                    rel_path = os.path.relpath(file_path, root_dir)
                                    print(f"MATCH: '{key}' in {rel_path}:{i+1} -> {line.strip()[:100]}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    search_keys(os.getcwd())
