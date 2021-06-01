import cv2
img = cv2.imread('cards.png')
for r in range(0,img.shape[0],75):
    for c in range(0,img.shape[1],50):
        cv2.imwrite(f"img{r}_{c}.png",img[r:r+75, c:c+50,:])