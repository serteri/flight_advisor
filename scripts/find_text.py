import os

def search_text(root_dir, search_terms):
    print(f"Searching for {search_terms}...")
    
    for root, dirs, files in os.walk(root_dir):
        # Skip node_modules and hidden dirs
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.git' in dirs: dirs.remove('.git')
        if '.next' in dirs: dirs.remove('.next')
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                if file == 'find_text.py': continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        for i, line in enumerate(f):
                            for term in search_terms:
                                if term in line:
                                    print(f"MATCH: {term} in {file}:{i+1}")
                except:
                    pass

if __name__ == "__main__":
    terms = ["bookButton", "Results.bookButton", "safeRedirect", "Results.safeRedirect", "View Deal"]
    search_text(os.getcwd(), terms)
