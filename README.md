# B2 SLAM Benchmark Dashboard V1

一个可持续追加算法方案的本地 SLAM 对比网页。当前已预置：

- FAST-LIO2
- LIO-SAM Loop Closure OFF
- LIO-SAM Loop Closure ON

## 1. 放到 Ubuntu 上

解压后进入目录：

```bash
cd ~/slam_benchmark_web_v1
```

## 2. 准备三段录像

脚本默认读取你当前的三份正式录像：

```text
/home/lee/FAST-LIO2_FULL_office_record.mkv
/home/lee/LIO-SAM_OFF_FULL_office_record.mkv
/home/lee/LIO-SAM_ON_FULL_office_record.mkv
```

执行：

```bash
bash scripts/prepare_videos.sh
```

脚本使用 ffmpeg 将 H.264/AAC MKV 快速无损封装为浏览器更容易播放的 MP4：

```text
media/fastlio2.mp4
media/liosam_off.mp4
media/liosam_on.mp4
```

## 3. 启动网页

```bash
./serve.sh
```

浏览器打开：

```text
http://127.0.0.1:8080
```

如果 8080 被占用：

```bash
./serve.sh 8081
```

## 4. 后续新增方案

例如加入 `FAST-LIO2 + SC-PGO`：

```bash
cp experiments/_template.json experiments/fastlio2_scpgo.json
```

编辑该 JSON，把新 benchmark 数据填进去，然后：

```bash
python3 scripts/build_data.py
```

刷新网页即可。筛选项、卡片、柱状图、详细表、部署约束和视频区都会自动增加新方案，不需要修改前端 JS。

## 5. 数据可信度

当前 LIO-SAM ON 的资源占用数据标记为 `quality-run`，不是 dedicated/formal resource run。网页会用黄色状态提示，不会把它伪装成正式资源测试。

当前没有 Ground Truth，因此：

- Revisit C2C = 重访一致性，不是绝对精度；
- Start-End separation ≠ ATE；
- 地图点数更多 ≠ 地图一定更准确。

## 目录

```text
slam_benchmark_web_v1/
├── index.html
├── project.json
├── assets/
│   ├── app.js
│   └── styles.css
├── data/
│   └── experiments.json       # build_data.py 自动生成
├── experiments/
│   ├── fastlio2.json
│   ├── liosam_off.json
│   ├── liosam_on.json
│   └── _template.json
├── media/                     # MP4 放这里
├── scripts/
│   ├── build_data.py
│   └── prepare_videos.sh
└── serve.sh
```

## V1.1 指标说明

Dashboard 增加了“数据指标说明 / Metric Guide”区域，解释 CPU、RAM、轨迹、地图几何、Revisit C2C、Loop Closure 等指标的含义、判读方式和注意事项。详细数据表中的 `?` 可跳转到对应说明。新增 benchmark 指标时，可在 `assets/app.js` 的 `metricGlossary` 中继续补充说明。
