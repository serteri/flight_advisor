import os

def search_text(root_dir, search_terms):
    print(f"Searching for {search_terms} in {root_dir}...")
    
    for root, dirs, files in os.walk(root_dir):
        # Skip node_modules and hidden dirs
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.git' in dirs: dirs.remove('.git')
        if '.next' in dirs: dirs.remove('.next')
            
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx', '.json')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for term in search_terms:
                            if term in content:
                                print(f"MATCH: '{term}' found in {file_path}")
                except UnicodeDecodeError:
                    # Fallback for non-utf8 files
                    try:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                            if any(term in content for term in search_terms):
                                print(f"MATCH (latin-1): '{term}' found in {file_path}")
                    except:
                        pass
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

if __name__ == "__main__":
    terms = ["bookButton", "safeRedirect", "View Deal", "Safe Redirect"]
    search_text(os.getcwd(), terms)
