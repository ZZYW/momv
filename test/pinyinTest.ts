
import pinyin from 'chinese-to-pinyin'



const name = [
    "陆金河",
    "零玉霭",
    "贰白雾",
    "千木涛",
    "玖红霭",
    "零红壑",
    "陆黑壑",
    "千土涧",
    "千木霄",
    "叁银雾",
    "零黑雾",
    "零黑涛",
    "捌木雾",
    "壹黑霭",
    "壹玉涧",
    "壹水河",
    "零石雾",
    "玖白壑",
    "贰青涧",
    "捌水壑",
    "千玉霄"
]


name.forEach(i => {
    console.log(pinyin(i).toUpperCase())
})