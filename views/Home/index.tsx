import { Banner, Button, Form, Space, Spin, Toast } from "@douyinfe/semi-ui";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./index.module.css";
import { useTranslation } from "next-i18next";
import { BsSdk } from "@/libs/bs-sdk/BsSdk";
import BProvide from "@/libs/bs-sdk/components/b-provide";
import { BsORM } from "@/libs/bs-sdk/BsORM";
import BSelectField from "@/libs/bs-sdk/components/b-select-field";
import Section from "@douyinfe/semi-ui/lib/es/form/section";
import ECharts from "@/components/echarts";
import {
  base64ToFile,
  downloadFile,
  fileToIOpenAttachment,
  useKeepState,
} from "@/libs/bs-sdk/shared";
import { FieldType } from "@lark-base-open/js-sdk";

const bsSdk = new BsSdk({
  onSelectionChange: true,
  immediatelySelectionChange: true,
});

const orm = new BsORM(bsSdk);

export default function Home() {
  const [t, i18n] = useTranslation();
  const echartRef = useRef();
  const [conf, setConf] = useKeepState<any>({
    output: { type: "preview" },
    chartType: "line",
    chart: { max: 10, min: 0, order: "default", auto: true, showValue: true },
    format: true,
    formatCode: {},
  });
  const [option, setOption] = useState<any>(
    createOption(
      "line",
      {
        A: 10,
        B: 0,
        C: 10,
      },
      conf?.chart
    )
  );

  const setConfValue = useCallback(
    (value: any) => {
      conf.select = value.select;
      setConf(Object.assign({}, mergeDeep(conf, value)));
    },
    [conf, setConf]
  );

  const uiConf = () => {
    const map: any = {
      get bar() {
        return (
          <>
            <Form.Select
              field="chart.order"
              label={t("chart-conf-order")}
              placeholder={t("chart-conf-" + conf.chart.order)}
              optionList={[
                { label: t("chart-conf-default"), value: "default" },
                { label: t("chart-conf-asc"), value: "asc" },
                {
                  label: t("chart-conf-desc"),
                  value: "desc",
                },
              ]}
            ></Form.Select>
          </>
        );
      },
      get line() {
        return (
          <>
            <Form.Select
              field="chart.order"
              label={t("chart-conf-order")}
              placeholder={t("chart-conf-" + conf.chart.order)}
              optionList={[
                { label: t("chart-conf-default"), value: "default" },
                { label: t("chart-conf-asc"), value: "asc" },
                {
                  label: t("chart-conf-desc"),
                  value: "desc",
                },
              ]}
            ></Form.Select>
          </>
        );
      },

      get radar() {
        return (
          <>
            <Form.Switch
              field="chart.showValue"
              label={t("chart-conf-showValue")}
              defaultValue={conf.chart.showValue}
              initValue={conf.chart.showValue}
            ></Form.Switch>
            <Form.Switch
              field="chart.auto"
              label={t("chart-conf-auto")}
              defaultValue={conf.chart.auto}
              initValue={conf.chart.auto}
              onChange={(v) => setConfValue({ chart: { auto: v } })}
            ></Form.Switch>
            {!conf.chart?.auto && (
              <>
                <Form.InputNumber
                  field="chart.max"
                  placeholder={conf.chart.max}
                  label={t("chart-conf-max")}
                ></Form.InputNumber>
                <Form.InputNumber
                  field="chart.min"
                  placeholder={conf.chart.min}
                  label={t("chart-conf-min")}
                ></Form.InputNumber>
              </>
            )}
          </>
        );
      },
    };

    return map[conf.chartType] || null;
  };

  // console.log(conf);

  useEffect(() => {
    // const clear = bsSdk.selectionChangeEmitter.on(async (e) => {
    //   const { record, field } = await bsSdk.getSelectionQuery(e.data);
    //   console.log("record", record);
    //   console.log("field", field);
    //   console.log(e);
    // });
    // return clear;
    console.log("useEffect");
    bsSdk.bitable.bridge.getLanguage().then((lang) => {
      i18n.changeLanguage(lang.includes("zh") ? "zh" : "en");
    });
  }, []);

  const onSubmit = useCallback(
    async (nconf: any) => {
      console.log(
        nconf,
        echartRef
        // downloadFile(base64ToFile(url, Date.now() + ".png", "image/png"))
      );
      conf.select = nconf.select;
      nconf = mergeDeep(conf, nconf);
      if (nconf.chart.isExpr) {
        nconf.chart.expr = nconf.chart.expr || {};
        for (let i = 0; i < nconf.select.length; i++) {
          const fieldId = nconf.select[i];
          if (!nconf.chart.expr[fieldId]) {
            nconf.chart.expr[fieldId] = "x";
          }
        }
      } else {
        nconf.chart.expr = {};
      }
      if (Object.keys(nconf?.select || {}).length === 0)
        return Toast.error(t("toast-select-number-field"));
      let load = Toast.info({
        icon: <Spin />,
        content: `${t("toast-gening")}...`,
        duration: 0,
      });
      let recordId = "";
      if (nconf.output.type !== "multiToField") {
        const select = await bsSdk.getSelection();
        console.log({ select });

        if (select.recordId) {
          recordId = select.recordId as string;
        } else {
          if (nconf?.output?.type === "preview") {
            recordId = await (await bsSdk.getActiveTable())
              .getRecords({ pageSize: 1 })
              .then((res) => res.records[0].recordId);
          }
        }
      }
      console.log({ recordId });

      if (nconf.output.type === "multiToField") {
        const recordIds = await bsSdk.getRecordIds();
        if (!recordIds.length) return Toast.error(t("toast-add-record"));
        for (let i = 0; i < recordIds.length; i++) {
          Toast.close(load);
          load = Toast.info({
            icon: <Spin />,
            content: `${t("toast-gening")}(${i + 1}/${recordIds.length})...`,
            duration: 0,
          });
          const recordId = recordIds[i];
          const url = await gene(recordId);
          if (!url) continue;
          const outfield = orm.getFieldsMap().get(nconf.output.field);
          if ((await outfield?.getType()) !== FieldType.Attachment) {
            Toast.close(load);
            return Toast.error(t("toast-select-field"));
          }
          outfield?.setValue(recordId, [
            await fileToIOpenAttachment(
              bsSdk.base,
              base64ToFile(url, Date.now() + ".png", "image/png")
            ),
          ]);
        }
      } else if (nconf.output.type === "toField") {
        if (!recordId) {
          Toast.close(load);
          return Toast.error(t("toast-select-record"));
        }

        const url = await gene(recordId);

        const outfield = orm.getFieldsMap().get(nconf.output.field);
        if ((await outfield?.getType()) !== FieldType.Attachment) {
          Toast.close(load);
          return Toast.error(t("toast-select-field"));
        }
        outfield?.setValue(recordId, [
          await fileToIOpenAttachment(
            bsSdk.base,
            base64ToFile(url, Date.now() + ".png", "image/png")
          ),
        ]);
      } else {
        if (!recordId) {
          Toast.close(load);
          return Toast.error(t("toast-select-record"));
        }
        await gene(recordId);
      }
      Toast.close(load);
      Toast.success(t("toast-gene-success"));

      async function gene(recordId: string) {
        const record = await orm.getRecord(recordId);
        const selectFieldRecord = nconf.select.reduce(
          (map: any, fieldId: string) => {
            let v = toDisplay(record[fieldId]);
            if (!v) {
              v = 0;
            }
            v = Number(v);
            // console.log("select", v, fieldId, record[fieldId]);

            if (typeof v === "number" && v === v) {
              map[orm.getFieldsMap()?.get(fieldId)?.name as string] = nconf
                .chart?.expr?.[fieldId]
                ? parseExpr(nconf.chart.expr[fieldId], { x: v }, () => v)
                : v;
            }
            return map;
          },
          {}
        );

        if (Object.keys(selectFieldRecord).length === 0) {
          return;
        }

        setOption(
          createOption(nconf.chartType, selectFieldRecord, nconf?.chart)
        );
        console.log(record, selectFieldRecord);

        await new Promise((resolve) => setTimeout(resolve, 1));
        const url = (echartRef.current as any)?.getDataURL();
        return url;
      }
    },
    [conf, t]
  );

  const onChange = useCallback(
    (e: any) => {
      // console.log("onChange", e);
      setConfValue(e.values);
    },
    [setConfValue]
  );

  function createOption(chartType: string, data: any, opt: any = {}) {
    let keys = Object.keys(data);
    const maxKeyLen = Math.max(...keys.map((key) => key.length));
    if (opt.order === "asc" || opt.order === "desc") {
      keys = extractAndSortNumbers(keys);
      if (opt.order === "desc") {
        keys = keys.reverse();
      }
    }
    if (opt.auto && keys.length) {
      opt.max = Math.max(...keys.map((key) => data[key]));
      opt.min = 0;
    }
    return (
      (
        {
          get line() {
            return {
              wrapStyle: {
                width: `${(keys.length ?? 0) * 100 + 100}px`,
                height: `500px`,
              },
              animation: false,
              xAxis: {
                type: "category",
                data: keys,
              },
              yAxis: {
                type: "value",
              },
              series: [
                {
                  data: keys.map((key) => data[key]),
                  type: "line",
                },
              ],
            };
          },
          get bar() {
            return {
              wrapStyle: {
                width: `${(keys.length ?? 0) * 100 + 100}px`,
                height: `500px`,
              },

              animation: false,
              xAxis: {
                type: "category",
                data: keys,
              },
              yAxis: {
                type: "value",
              },
              series: [
                {
                  data: keys.map((key) => data[key]),
                  type: "bar",
                },
              ],
            };
          },
          get radar() {
            const maxVal = Math.max(...keys.map((key) => data[key]));
            return {
              wrapStyle: {
                width: `500px`,
                height: `500px`,
              },

              animation: false,
              // title: {
              //   text: "Basic Radar Chart",
              // },
              // legend: {
              //   data: ["Allocated Budget", "Actual Spending"],
              // },
              textStyle: {
                fontSize: 16,
              },
              radar: {
                // shape: 'circle',
                // indicator: [
                //   { name: "Sales" },
                //   { name: "Administration" },
                //   { name: "Information Technology" },
                //   { name: "Customer Support" },
                //   { name: "Development" },
                //   { name: "Marketing" },
                // ],
                indicator: keys.map((key) => ({
                  name: key,
                  max: data[key] > opt.max ? data[key] : opt.max,
                  min: opt.min,
                  color: data[key] > opt.max ? "red" : undefined,
                  // key.length > 6
                  //   ? key.slice(0, 6) + "\n" + key.slice(6, key.length)
                  //   : key,
                })),
                axisName: {
                  color: "#5470c6",
                },
                center: ["50%", "50%"], // 将雷达图居中显示
                radius: maxKeyLen > 5 ? "50%" : maxKeyLen > 4 ? "60%" : "70%", // 设置雷达图的半径为容器高度的70%
              },
              series: [
                {
                  name: "Budget vs spending",
                  type: "radar",
                  data: [
                    {
                      value: keys.map((key) => data[key]),
                      areaStyle: {
                        color: "rgba(66, 139, 212, 0.3)",
                      },
                      label: {
                        show: opt.showValue,
                        position: "inside",
                      },
                      // name: "Allocated Budget",
                    },
                    // {
                    //   value: [4200, 3000, 20000, 35000, 50000, 18000],
                    //   name: "Allocated Budget",
                    // },
                    // {
                    //   value: [5000, 14000, 28000, 26000, 42000, 21000],
                    //   name: "Actual Spending",
                    // },
                  ],
                },
              ],
            };
          },
        } as any
      )[chartType] || {}
    );
  }

  return (
    <main className={styles.main}>
      <BProvide
        orm={orm}
        formProps={{
          onSubmit,
          onChange,
          labelPosition: "left",
          initValues: conf,
        }}
        loadingText={t("init")}
      >
        <Section text={t("field-conf")} style={{ marginTop: "10px" }}>
          <BSelectField
            field="select"
            label={t("select-field")}
            placeholder={t("select-field-tip")}
            multiple
          ></BSelectField>
        </Section>
        <Section text={t("chart-conf")} style={{ marginTop: "10px" }}>
          <Form.Select
            field="chartType"
            label={t("chart-conf-type")}
            optionList={[
              { label: t("chart-conf-line"), value: "line" },
              { label: t("chart-conf-bar"), value: "bar" },
              { label: t("chart-conf-radar"), value: "radar" },
            ]}
            onChange={(v: any) => {
              console.log(v);
              setConfValue({ chartType: v });
              // setOption(createOption(v, , opt))
            }}
          ></Form.Select>
          <Form.Switch
            field="chart.isExpr"
            label={t("chart-conf-expr")}
            defaultValue={conf.chart.isExpr}
            initValue={conf.chart.isExpr}
            onChange={(v) => setConfValue({ chart: { isExpr: v } })}
          ></Form.Switch>
          {conf.chart?.isExpr &&
            conf.select?.map((fieldId: string) => (
              <Form.Input
                key={fieldId}
                field={`chart.expr.${fieldId}`}
                label={orm.getFieldsMap()?.get(fieldId)?.name}
                placeholder="x"
              ></Form.Input>
            ))}
          {uiConf()}
        </Section>
        <Section text={t("output-conf")} style={{ marginTop: "10px" }}>
          <Form.Select field="output.type" label={t("output-type")}>
            <Form.Select.Option value={"preview"}>
              {t("priview")}
            </Form.Select.Option>
            <Form.Select.Option value={"toField"}>
              {t("gene-to-field")}
            </Form.Select.Option>
            <Form.Select.Option value={"multiToField"}>
              {t("gene-multi-to-field")}
            </Form.Select.Option>
          </Form.Select>
          {conf?.output && conf?.output?.type !== "preview" && (
            <>
              <BSelectField
                field="output.field"
                filterOption={(field) => field?.type === FieldType.Attachment}
                label={t("output-field")}
                placeholder={t("output-field-tip")}
              ></BSelectField>
              <Banner
                type="danger"
                description={t("output-field-danger")}
                style={{ marginBottom: "10px" }}
              />
            </>
          )}
        </Section>
        <Space>
          <Button htmlType="submit" block type="primary">
            {t("btn-gene")}
          </Button>
          <Button
            type="secondary"
            block
            onClick={() => open("https://zhuanlan.zhihu.com/p/669107200")}
          >
            {t("btn-help")}
          </Button>
        </Space>
        <div style={{ width: "100%", overflow: "scroll" }}>
          <div style={option.wrapStyle}>
            <ECharts refInstance={echartRef} option={option}></ECharts>
          </div>
        </div>
      </BProvide>
    </main>
  );
}

function toDisplay(cell: any) {
  return typeof cell === "object"
    ? cell?.text ??
        cell
          ?.map?.((item: any) => item?.text ?? item?.name)
          .filter((item: any) => item)
          .join(",")
    : cell;
}

function extractAndSortNumbers(strings: any[]) {
  // 定义中文数字映射
  const chineseNumberMap: any = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
    亿: 100000000,
  };

  // 中文数字转阿拉伯数字
  function chineseToNumber(chineseStr: string) {
    let total = 0;
    let temp = 0;
    let prevUnit = 1;

    for (const char of chineseStr.split("")) {
      let value = chineseNumberMap[char];
      if (value < 10) {
        temp = value;
      } else {
        if (temp === 0) temp = 1;
        if (value > prevUnit) {
          total += temp;
          total *= value;
          temp = 0;
        } else {
          total += temp * value;
        }
        prevUnit = value;
        temp = 0;
      }
    }
    return total + temp;
  }

  // 提取数字并映射为数字值的函数
  function extractNumber(str: string) {
    const numberPattern = /(\d+|[零一二三四五六七八九十百千万亿]+)/g;
    const matches = str.match(numberPattern);
    if (!matches) return 0;

    return matches.reduce((sum: number, match: string) => {
      return (
        sum + (isNaN(Number(match)) ? chineseToNumber(match) : Number(match))
      );
    }, 0);
  }

  // 排序函数，将包含数字的词进行排序
  function sortWithNumbers(a: any, b: any) {
    const numA = extractNumber(a);
    const numB = extractNumber(b);
    return numA - numB;
  }

  // 使用排序函数对字符串数组进行排序
  return strings.slice().sort(sortWithNumbers);
}

function mergeDeep(a: any, b: any) {
  const keys = Object.keys(b);
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    const key = keys[i];
    if (typeof b[key] === "object") {
      if (typeof a[key] === "object") {
        mergeDeep(a[key], b[key]);
      } else {
        a[key] = b[key];
      }
    } else {
      a[key] = b[key];
    }
  }
  return a;
}

function parseExpr(expr: string, ctx: any, cb: any) {
  // 运行expr
  try {
    return new Function("ctx", `with(ctx){return ${expr}}`)(ctx);
  } catch (error) {
    return cb();
  }
}
