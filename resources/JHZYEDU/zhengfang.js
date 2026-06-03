// 江西航空职业技术学院(jhzyedu.cn) 拾光课程表适配脚本 — 本地版
// 正方教务系统V9.0 API方案 + 自动识别学年学期
// ⚠️ 仅本地使用，不提交PR

/**
 * 根据学期推测开学日期
 * 春季学期：当年 2 月最后一个周一
 * 秋季学期：当年 9 月第一个周一
 */
function guessStartDate(semesterIndex, academicYear) {
    if (semesterIndex === 1) {
        // 第二学期（春季）：当年 2 月最后一个周一
        var feb28 = new Date(academicYear + 1, 1, 28);
        var lastMonday = new Date(feb28);
        lastMonday.setDate(feb28.getDate() - ((feb28.getDay() + 6) % 7));
        return lastMonday.getFullYear() + "-" +
            String(lastMonday.getMonth() + 1).padStart(2, "0") + "-" +
            String(lastMonday.getDate()).padStart(2, "0");
    } else {
        // 第一学期（秋季）：9 月第一个周一
        var sep1 = new Date(academicYear, 8, 1);
        var firstMonday = new Date(sep1);
        firstMonday.setDate(sep1.getDate() + (8 - sep1.getDay()) % 7);
        return firstMonday.getFullYear() + "-" +
            String(firstMonday.getMonth() + 1).padStart(2, "0") + "-" +
            String(firstMonday.getDate()).padStart(2, "0");
    }
}

/**
 * 根据当前日期自动推算学年和学期
 * 2-7月  → 春季学期（第二学期），起始年=当前年-1
 * 8-12月 → 秋季学期（第一学期），起始年=当前年
 * 1月    → 秋季学期（第一学期），起始年=当前年-1（仍属上学年秋季）
 */
function autoDetectSemester() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    if (month >= 2 && month <= 7) {
        return { academicYear: year - 1, semesterIndex: 1, label: (year-1) + "-" + year + " 第二学期" };
    } else if (month === 1) {
        return { academicYear: year - 1, semesterIndex: 0, label: (year-1) + "-" + year + " 第一学期" };
    } else {
        return { academicYear: year, semesterIndex: 0, label: year + "-" + (year+1) + " 第一学期" };
    }
}

/**
 * 解析周次字符串，处理单双周和周次范围。
 */
function parseWeeks(weekStr) {
    if (!weekStr) return [];
    const weekSets = weekStr.split(',');
    let weeks = [];
    for (const set of weekSets) {
        const trimmedSet = set.trim();
        const rangeMatch = trimmedSet.match(/(\d+)-(\d+)周/);
        const singleMatch = trimmedSet.match(/^(\d+)周/);
        let start = 0, end = 0, processed = false;
        if (rangeMatch) { start = Number(rangeMatch[1]); end = Number(rangeMatch[2]); processed = true; }
        else if (singleMatch) { start = end = Number(singleMatch[1]); processed = true; }
        if (processed) {
            const isSingle = trimmedSet.includes('(单)');
            const isDouble = trimmedSet.includes('(双)');
            for (let w = start; w <= end; w++) {
                if (isSingle && w % 2 === 0) continue;
                if (isDouble && w % 2 !== 0) continue;
                weeks.push(w);
            }
        }
    }
    return [...new Set(weeks)].sort((a, b) => a - b);
}

/**
 * 解析 API 返回的 JSON 数据。
 */
function parseJsonData(jsonData) {
    console.log("JS: parseJsonData 正在解析 JSON 数据...");
    if (!jsonData || !Array.isArray(jsonData.kbList)) {
        console.warn("JS: JSON 数据结构错误或缺少 kbList 字段。");
        return [];
    }
    const rawCourseList = jsonData.kbList;
    const finalCourseList = [];
    for (const rawCourse of rawCourseList) {
        if (!rawCourse.kcmc || !rawCourse.xm || !rawCourse.cdmc || 
            !rawCourse.xqj || !rawCourse.jcs || !rawCourse.zcd) continue;
        const weeksArray = parseWeeks(rawCourse.zcd);
        if (weeksArray.length === 0) continue;
        const sectionParts = rawCourse.jcs.split('-');
        const startSection = Number(sectionParts[0]);
        const endSection = Number(sectionParts[sectionParts.length - 1]);
        const day = Number(rawCourse.xqj);
        if (isNaN(day) || isNaN(startSection) || isNaN(endSection) || day < 1 || day > 7 || startSection > endSection) continue;
        finalCourseList.push({
            name: rawCourse.kcmc.trim(),
            teacher: rawCourse.xm.trim(),
            position: rawCourse.cdmc.trim(),
            day: day,
            startSection: startSection,
            endSection: endSection,
            weeks: weeksArray
        });
    }
    finalCourseList.sort((a, b) => a.day - b.day || a.startSection - b.startSection || a.name.localeCompare(b.name));
    console.log(`JS: JSON 数据解析完成，共找到 ${finalCourseList.length} 门课程。`);
    return finalCourseList;
}

function getSemesterCode(semesterIndex) {
    return semesterIndex === 0 ? "3" : "12";
}

/**
 * 通过 API 请求课表数据
 */
async function fetchAndParseCourses(academicYear, semesterIndex) {
    var semesterCode = getSemesterCode(semesterIndex);
    var requestBody = "xnm=" + academicYear + "&xqm=" + semesterCode + "&kzlx=ck&xsdm=&kclbdm=";
    var apiUrl = "https://jw.jhzyedu.cn/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151";

    AndroidBridge.showToast("正在通过API获取课表数据...");
    try {
        var response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: requestBody,
            credentials: "include"
        });
        if (response.ok) {
            var jsonText = await response.text();
            var jsonData = JSON.parse(jsonText);
            if (jsonData && jsonData.kbList) {
                var parsedCourses = parseJsonData(jsonData);
                if (parsedCourses.length > 0) {
                    return parsedCourses;
                }
            }
        }
        AndroidBridge.showToast("API 返回数据异常，请检查登录状态。");
        return null;
    } catch (e) {
        console.error("API fetch error: " + e.message);
        AndroidBridge.showToast("请求课表数据失败，请确认已登录教务系统。");
        return null;
    }
}

async function saveCourses(parsedCourses) {
    AndroidBridge.showToast("正在保存 " + parsedCourses.length + " 门课程...");
    try {
        await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(parsedCourses, null, 2));
        console.log("JS: 课程保存成功！");
        return true;
    } catch (error) {
        AndroidBridge.showToast("课程保存失败: " + error.message);
        return false;
    }
}

// 江西航空职业技术学院作息时间（每节40分钟）
const TimeSlots = [
    { number: 1, startTime: "09:00", endTime: "09:40" },
    { number: 2, startTime: "09:45", endTime: "10:25" },
    { number: 3, startTime: "10:35", endTime: "11:15" },
    { number: 4, startTime: "11:20", endTime: "12:00" },
    { number: 5, startTime: "13:30", endTime: "14:10" },
    { number: 6, startTime: "14:15", endTime: "14:55" },
    { number: 7, startTime: "15:05", endTime: "15:45" },
    { number: 8, startTime: "15:50", endTime: "16:30" }
];

async function importPresetTimeSlots(timeSlots) {
    if (timeSlots.length > 0) {
        AndroidBridge.showToast("正在导入 " + timeSlots.length + " 个预设时间段...");
        try {
            await window.AndroidBridgePromise.savePresetTimeSlots(JSON.stringify(timeSlots));
            AndroidBridge.showToast("预设时间段导入成功！");
        } catch (error) {
            AndroidBridge.showToast("导入时间段失败: " + error.message);
        }
    }
}

function validateWeekInput(input) {
    var n = parseInt(input);
    if (!isNaN(n) && n >= 1 && n <= 30) return false;
    return "请输入1-30之间的数字！";
}

function calcWeek(startDateStr) {
    var start = new Date(startDateStr + "T00:00:00+08:00");
    var now = new Date();
    var diff = now - start;
    if (diff < 0) return 1;
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}


async function runImportFlow() {
    // --- 自动检测学年学期 ---
    const auto = autoDetectSemester();
    const confirmed = await window.AndroidBridgePromise.showAlert(
        "自动检测学期",
        "当前日期：" + new Date().toLocaleDateString("zh-CN") +
        "\n自动识别：" + auto.label +
        "\n\n如果正确请点确定，不对请点取消手动选择。",
        "确定，继续"
    );

    let academicYear, semesterIndex;

    if (confirmed) {
        academicYear = auto.academicYear;
        semesterIndex = auto.semesterIndex;
    } else {
        // 手动选择学年
        const yearInput = await window.AndroidBridgePromise.showPrompt(
            "选择学年",
            "请输入起始学年（如 2025 表示 2025-2026 学年）:",
            String(auto.academicYear),
            "validateYearInput"
        );
        if (yearInput === null) { AndroidBridge.showToast("导入已取消。"); return; }
        academicYear = parseInt(yearInput);

        // 手动选择学期
        const semIndex = await window.AndroidBridgePromise.showSingleSelection(
            "选择学期",
            JSON.stringify(["第一学期", "第二学期"]),
            auto.semesterIndex
        );
        if (semIndex === null || semIndex === -1) { AndroidBridge.showToast("导入已取消。"); return; }
        semesterIndex = semIndex;
    }

    // --- 当前第几周（反推开学日期） ---
    var defaultDate = guessStartDate(semesterIndex, academicYear);
    var guessedWeek = calcWeek(defaultDate);
    var weekInput = await window.AndroidBridgePromise.showPrompt(
        "当前是第几周？",
        "请确认当前是教学第几周（看课表上任意一门从第1周开始的课推算）:\n\n自动推测: 第 " + guessedWeek + " 周",
        String(guessedWeek),
        "validateWeekInput"
    );
    if (weekInput === null) { AndroidBridge.showToast("导入已取消。"); return; }
    var currentWeek = parseInt(weekInput);
    // 反推开学日期: 今天 - (当前周数-1) × 7天，对齐到最近的周一
    var today = new Date();
    var msPerWeek = 7 * 24 * 60 * 60 * 1000;
    var semesterStart = new Date(today.getTime() - (currentWeek - 1) * msPerWeek);
    var dayOfWeek = semesterStart.getDay();
    var offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    semesterStart.setDate(semesterStart.getDate() + offset);
    var startDateInput = semesterStart.getFullYear() + "-" +
        String(semesterStart.getMonth() + 1).padStart(2, "0") + "-" +
        String(semesterStart.getDate()).padStart(2, "0");

    // --- 请求课表 ---
    var courses = await fetchAndParseCourses(academicYear, semesterIndex);
    if (courses === null) return;

    // --- 保存课程 ---
    var saveResult = await saveCourses(courses);
    if (!saveResult) return;

    // 保存 config（包含学期开始日期 + 课时参数）
    try {
        await window.AndroidBridgePromise.saveCourseConfig(JSON.stringify({
            semesterStartDate: startDateInput,
            defaultClassDuration: 40,
            defaultBreakDuration: 5
        }));
    } catch (error) {
        console.warn("JS: Save Config failed: " + error.message);
    }

    // --- 导入作息 ---
    await importPresetTimeSlots(TimeSlots);

    // --- 完成 ---
    await window.AndroidBridgePromise.showAlert(
        "导入完成",
        courses.length + " 门课程 | " + (semesterIndex === 0 ? "第一学期" : "第二学期") +
        " | 第 " + currentWeek + " 周\n\n开学日期已自动设为: " + startDateInput +
        "\n如果周数不对，点课表顶部周次标题调整。",
        "知道了"
    );

    AndroidBridge.showToast("导入成功！" + courses.length + "门课，当前第" + currentWeek + "周");
    AndroidBridge.notifyTaskCompletion();
}

function validateYearInput(input) {
    if (/^[0-9]{4}$/.test(input)) return false;
    return "请输入四位数字的学年！";
}

runImportFlow();
