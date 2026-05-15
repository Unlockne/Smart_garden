import os
from PIL import Image

def clean_dataset(dataset_dir):
    print(f"Bắt đầu quét và sửa lỗi thư mục: {dataset_dir}")
    converted_count = 0
    corrupted_count = 0
    
    for root, dirs, files in os.walk(dataset_dir):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp')):
                path = os.path.join(root, file)
                try:
                    with Image.open(path) as img:
                        if img.mode != 'RGB':
                            if img.mode == 'RGBA':
                                background = Image.new('RGB', img.size, (255, 255, 255))
                                background.paste(img, mask=img.split()[3]) 
                                background.save(path)
                            else:
                                rgb_img = img.convert('RGB')
                                rgb_img.save(path)
                            print(f"  [Đã sửa hệ màu {img.mode} -> RGB]: {path}")
                            converted_count += 1
                except Exception as e:
                    print(f"  [Đã xóa ảnh hỏng]: {path} - Lỗi: {e}")
                    os.remove(path)
                    corrupted_count += 1
                    
    print("-" * 50)
    print(f"Đã tự động chuyển đổi {converted_count} ảnh về chuẩn RGB và xóa {corrupted_count} ảnh hỏng dữ liệu.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_dir = os.path.join(base_dir, "datasets")
    
    if os.path.exists(dataset_dir):
        clean_dataset(dataset_dir)
    else:
        print(f"Không tìm thấy thư mục {dataset_dir}")
